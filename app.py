
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
from datetime import datetime
from bson.errors import InvalidId

app = Flask(__name__)
app.secret_key = "canteen-management-secret"

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["canteen_db"]

menu = db["menu"]
orders = db["orders"]


# Create collections with validation if they do not exist.
# Existing collections and their validators are preserved.
def create_collection_if_missing(name, validator):
    if name not in db.list_collection_names():
        db.create_collection(
            name,
            validator=validator,
            validationLevel="strict",
            validationAction="error"
        )


menu_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "category", "price"],
        "properties": {
            "name": {"bsonType": "string"},
            "category": {
                "bsonType": "string",
                "enum": ["Snacks", "Meals", "Beverages"]
            },
            "price": {
                "bsonType": ["int", "double", "decimal"],
                "minimum": 1
            }
        }
    }
}

orders_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["student", "items", "total", "payment", "date"],
        "properties": {
            "student": {"bsonType": "string"},
            "items": {
                "bsonType": "array",
                "minItems": 1
            },
            "total": {
                "bsonType": ["int", "double", "decimal"],
                "minimum": 0
            },
            "payment": {
                "bsonType": "string",
                "enum": ["Cash", "UPI", "Card"]
            },
            "date": {"bsonType": "date"},
            "status": {
                "bsonType": "string",
                "enum": ["Pending", "Preparing", "Completed", "Cancelled"]
            }
        }
    }
}

create_collection_if_missing("menu", menu_validator)
create_collection_if_missing("orders", orders_validator)


# Insert sample menu only when menu is empty
if menu.count_documents({}) == 0:
    menu.insert_many([
        {"name": "Samosa", "category": "Snacks", "price": 15},
        {"name": "Veg Burger", "category": "Snacks", "price": 50},
        {"name": "Rajma Chawal", "category": "Meals", "price": 80},
        {"name": "Paneer Thali", "category": "Meals", "price": 120},
        {"name": "Masala Chai", "category": "Beverages", "price": 10},
        {"name": "Cold Coffee", "category": "Beverages", "price": 60}
    ])


# HOME PAGE
@app.route("/")
def index():
    popular_items = list(menu.find().limit(4))
    return render_template("index.html", items=popular_items)


# VIEW MENU
@app.route("/menu")
def view_menu():
    items = list(menu.find())
    return render_template("menu.html", items=items)


# CART PAGE
@app.route("/cart")
def cart():
    return render_template("cart.html")


# PLACE ORDER
@app.route("/place-order", methods=["POST"])
def place_order():
    data = request.get_json(silent=True) or {}

    student = str(data.get("student", "")).strip()
    payment = data.get("payment")
    cart_items = data.get("items", [])

    if not student:
        return jsonify({"success": False, "message": "Enter your name."}), 400

    if payment not in ["Cash", "UPI", "Card"]:
        return jsonify({"success": False, "message": "Invalid payment method."}), 400

    if not isinstance(cart_items, list) or not cart_items:
        return jsonify({"success": False, "message": "Your cart is empty."}), 400

    final_items = []
    total = 0

    # Get actual prices from MongoDB instead of trusting browser prices
    for cart_item in cart_items:
        try:
            item_id = ObjectId(str(cart_item.get("id", "")))
            quantity = int(cart_item.get("qty", 0))
        except (InvalidId, TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid cart item."}), 400

        if quantity < 1 or quantity > 50:
            return jsonify({"success": False, "message": "Invalid quantity."}), 400

        food = menu.find_one({"_id": item_id})

        if food is None:
            return jsonify({"success": False, "message": "A menu item is unavailable."}), 400

        subtotal = food["price"] * quantity
        total += subtotal

        final_items.append({
            "name": food["name"],
            "category": food["category"],
            "price": food["price"],
            "qty": quantity
        })

    order = {
        "student": student,
        "items": final_items,
        "total": total,
        "payment": payment,
        "date": datetime.now(),
        "status": "Pending"
    }

    result = orders.insert_one(order)

    return jsonify({
        "success": True,
        "message": "Order placed successfully!",
        "order_id": str(result.inserted_id),
        "total": total
    })


# VIEW ORDERS
@app.route("/orders")
def view_orders():
    student = request.args.get("student", "").strip()

    if student:
        order_list = list(
            orders.find({"student": {"$regex": student, "$options": "i"}})
            .sort("date", DESCENDING)
        )
    else:
        order_list = list(orders.find().sort("date", DESCENDING))

    return render_template("orders.html", orders=order_list, student=student)


# ADMIN PAGE
@app.route("/admin")
def admin():
    menu_items = list(menu.find())
    order_list = list(orders.find().sort("date", DESCENDING))

    total_orders = orders.count_documents({})
    total_revenue = list(orders.aggregate([
        {"$match": {"status": {"$ne": "Cancelled"}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}}
    ]))

    revenue = total_revenue[0]["revenue"] if total_revenue else 0

    return render_template(
        "admin.html",
        items=menu_items,
        orders=order_list,
        total_orders=total_orders,
        revenue=revenue
    )


# ADD MENU ITEM
@app.route("/add-item", methods=["POST"])
def add_item():
    name = request.form.get("name", "").strip()
    category = request.form.get("category", "")
    price_text = request.form.get("price", "")

    try:
        price = float(price_text)
    except (ValueError, TypeError):
        flash("Enter a valid price.", "error")
        return redirect(url_for("admin"))

    if not name or category not in ["Snacks", "Meals", "Beverages"] or price < 1:
        flash("Enter valid menu item details.", "error")
        return redirect(url_for("admin"))

    if price.is_integer():
        price = int(price)

    menu.insert_one({
        "name": name,
        "category": category,
        "price": price
    })

    flash("Menu item added successfully!", "success")
    return redirect(url_for("admin"))


# DELETE MENU ITEM
@app.route("/delete-item/<item_id>", methods=["POST"])
def delete_item(item_id):
    try:
        result = menu.delete_one({"_id": ObjectId(item_id)})
    except InvalidId:
        result = None

    if result and result.deleted_count:
        flash("Menu item deleted.", "success")
    else:
        flash("Menu item not found.", "error")

    return redirect(url_for("admin"))


# UPDATE ORDER STATUS
@app.route("/update-status/<order_id>", methods=["POST"])
def update_status(order_id):
    status = request.form.get("status")

    allowed_statuses = [
        "Pending", "Preparing", "Completed", "Cancelled"
    ]

    if status not in allowed_statuses:
        flash("Invalid order status.", "error")
        return redirect(url_for("admin"))

    try:
        result = orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"status": status}}
        )
    except InvalidId:
        result = None

    if result and result.matched_count:
        flash("Order status updated.", "success")
    else:
        flash("Order not found.", "error")

    return redirect(url_for("admin"))


# AGGREGATION REPORTS
@app.route("/sales")
def sales():
    # 1. Sales by payment method
    payment_sales = list(orders.aggregate([
        {"$match": {"status": {"$ne": "Cancelled"}}},
        {
            "$group": {
                "_id": "$payment",
                "total_orders": {"$sum": 1},
                "total_sales": {"$sum": "$total"}
            }
        },
        {"$sort": {"total_sales": -1}}
    ]))

    # 2. Top two students by spending
    top_students = list(orders.aggregate([
        {"$match": {"status": {"$ne": "Cancelled"}}},
        {
            "$group": {
                "_id": "$student",
                "total_spent": {"$sum": "$total"}
            }
        },
        {"$sort": {"total_spent": -1}},
        {"$limit": 2}
    ]))

    # 3. Revenue by food category
    category_sales = list(orders.aggregate([
        {"$match": {"status": {"$ne": "Cancelled"}}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.category",
                "revenue": {
                    "$sum": {
                        "$multiply": ["$items.qty", "$items.price"]
                    }
                }
            }
        },
        {"$sort": {"revenue": -1}}
    ]))

    return jsonify({
        "payment_sales": payment_sales,
        "top_students": top_students,
        "category_sales": category_sales
    })


if __name__ == "__main__":
    app.run(debug=True)
