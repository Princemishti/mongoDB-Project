# 🍽️ Campus Canteen Management System

**Course:** CSE494 – Intelligent NoSQL Databases | **Academic Task 2 (Project)**  
**Stack:** Python (Flask) • MongoDB • PyMongo • HTML5 / Modern CSS3 / JavaScript  
**Repository:** [https://github.com/Princemishti/mongoDB-Project](https://github.com/Princemishti/mongoDB-Project)

---

## 1. Problem Statement and Real-World Relevance

University and campus canteens experience heavy demand during short breaks between lectures, serving hundreds of students daily. Traditional manual paper tokens and standalone spreadsheets face critical drawbacks:
- Long queues and delays during peak lunch and break hours.
- Lost or unreadable paper tickets leading to billing discrepancies.
- Lack of live status updates for students waiting on food preparation.
- Difficulties for canteen staff in tracking category revenues, identifying popular dishes, and monitoring customer payment trends.

This project delivers a **Full-Stack Canteen Order and Inventory Management Web Application** powered by **MongoDB** and **Flask (Python)**. MongoDB is uniquely suited for this domain because:
1. **Dynamic Order Structure:** A food order contains a variable-length list of food items, naturally represented as an embedded array of sub-documents without relational table joins.
2. **Snapshot Architecture:** Food item details (name, category, and unit price at time of purchase) are copied directly into the order document, insulating past receipts and financial reports against future menu price updates.
3. **Powerful Aggregation Framework:** Multi-stage aggregation pipelines generate real-time analytics (category revenue, payment mode breakdowns, and top customer rankings) directly within the database engine.

---

## 2. System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   • Responsive Web Interface (HTML5, Modern CSS3, JS)       │
│   • LocalStorage Shopping Cart & Real-Time Badge Count      │
│   • Client-Side Live Search & Category Filtering            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON REST
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Layer (Flask)                │
│   • app.py (Routing, Jinja2 Templates, API Endpoints)       │
│   • Server-Side Price Verification & Input Sanitization     │
│   • Flash Messaging & Dynamic State Management              │
└──────────────────────────────┬──────────────────────────────┘
                               │ PyMongo Driver (localhost:27017)
┌──────────────────────────────▼──────────────────────────────┐
│                    Database Layer (MongoDB)                 │
│   • Database: canteen_db                                    │
│   • Collections: menu, orders                               │
│   • $jsonSchema Strict Validation Rules                     │
│   • Aggregation Pipelines ($match, $unwind, $group, $sort)  │
└─────────────────────────────────────────────────────────────┘
```

- **Backend:** Python 3.8+ with Flask framework
- **Database:** MongoDB Community Server (v6.0+) via PyMongo driver
- **Frontend:** Responsive Jinja2 HTML templates, pure CSS3 design system, and Vanilla JavaScript
- **State Management:** Client-side `localStorage` for the active cart; MongoDB persistence for menu inventory and customer orders

---

## 3. Database & Document Schema Design

**Database Name:** `canteen_db`

### 3.1 Collection: `menu`
Stores all current food and beverage items available for purchase in the canteen.

```json
{
  "_id": { "$oid": "67232230a1b2c3d4e5f67890" },
  "name": "Samosa",
  "category": "Snacks",
  "price": 15
}
```

**Pre-seeded Menu Items:**
Upon initial launch, if the collection is empty, the system automatically bootstraps standard canteen items:
- `Samosa` (Snacks, ₹15)
- `Veg Burger` (Snacks, ₹50)
- `Rajma Chawal` (Meals, ₹80)
- `Paneer Thali` (Meals, ₹120)
- `Masala Chai` (Beverages, ₹10)
- `Cold Coffee` (Beverages, ₹60)

### 3.2 Collection: `orders`
Stores customer orders, embedded order items, transaction totals, and real-time status.

```json
{
  "_id": { "$oid": "67232230a1b2c3d4e5f67891" },
  "student": "Aman Verma",
  "items": [
    {
      "name": "Samosa",
      "category": "Snacks",
      "price": 15,
      "qty": 2
    },
    {
      "name": "Masala Chai",
      "category": "Beverages",
      "price": 10,
      "qty": 1
    }
  ],
  "total": 40,
  "payment": "UPI",
  "date": { "$date": "2026-10-31T12:00:00.000Z" },
  "status": "Pending"
}
```

### 3.3 Design Rationales
- **Embedding vs. Referencing:** The `items` array is embedded directly inside each `orders` document. Because order line items are always accessed together when viewing a bill, embedding avoids expensive `$lookup` operations and guarantees atomic order creation.
- **Snapshot Pattern:** The item name, category, and price are copied into the order document at checkout. Even if an administrator alters a menu item price later, historical order records remain immutable and mathematically correct.
- **Independent Catalog:** The `menu` collection remains separate from `orders` so canteen managers can add, adjust, or delete food items without affecting past customer transactions.

---

## 4. Strict Validation Rules (`$jsonSchema`)

Both collections enforce strict schema validation via MongoDB's `$jsonSchema` engine with `validationLevel="strict"` and `validationAction="error"`. Invalid inserts or updates are rejected at the database engine level.

### Collection `menu` Schema Validator
```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["name", "category", "price"],
    "properties": {
      "name": { "bsonType": "string" },
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
```

### Collection `orders` Schema Validator
```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["student", "items", "total", "payment", "date"],
    "properties": {
      "student": { "bsonType": "string" },
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
      "date": { "bsonType": "date" },
      "status": {
        "bsonType": "string",
        "enum": ["Pending", "Preparing", "Completed", "Cancelled"]
      }
    }
  }
}
```

---

## 5. CRUD Operations in the Application

| Operation | PyMongo Implementation | Route / Context | Description |
|---|---|---|---|
| **Create** | `menu.insert_one({...})` | `POST /add-item` | Adds a new food item to the catalog with category & price validation. |
| **Create** | `menu.insert_many([...])` | Initial startup | Seeds default food items if the `menu` collection is empty. |
| **Create** | `orders.insert_one(order)` | `POST /place-order` | Places a new customer order with verified item prices and timestamps. |
| **Read** | `menu.find()` / `menu.find().limit(4)` | `GET /menu`, `GET /` | Fetches active food items for the catalog and home page showcase. |
| **Read** | `menu.find_one({"_id": item_id})` | `POST /place-order` | Server-side price lookup verifying client cart integrity against database values. |
| **Read** | `orders.find().sort("date", DESCENDING)` | `GET /orders`, `GET /admin` | Lists customer orders sorted chronologically (most recent first). |
| **Read** | `orders.find({"student": {"$regex": ...}})` | `GET /orders?student=...` | Case-insensitive regular expression search for student order histories. |
| **Read** | `orders.count_documents({})` | `GET /admin` | Computes all-time total order count for staff KPI metric. |
| **Update** | `orders.update_one({"_id": ...}, {"$set": {"status": ...}})` | `POST /update-status/<order_id>` | Updates order lifecycle status (`Pending` ➔ `Preparing` ➔ `Completed` ➔ `Cancelled`). |
| **Delete** | `menu.delete_one({"_id": ...})` | `POST /delete-item/<item_id>` | Permanently removes a food item from the active menu catalog. |

---

## 6. MongoDB Aggregation Pipelines

The application leverages MongoDB's Aggregation Framework to calculate real-time business insights and staff KPIs, exposed via the `GET /sales` JSON endpoint and rendered interactively on the staff dashboard.

### Pipeline 1: Revenue by Food Category (Pipeline A)
**Purpose:** Unwinds individual order line items and groups by category to determine revenue contributions. Cancelled orders are excluded.
```python
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
```

### Pipeline 2: Sales and Order Count by Payment Method (Pipeline C)
**Purpose:** Evaluates payment mode adoption (UPI, Cash, Card) alongside total transaction revenue.
```python
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
```

### Pipeline 3: Top Spending Students (Pipeline E)
**Purpose:** Identifies top recurring campus customers by aggregate spending across all non-cancelled orders.
```python
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
```

### Pipeline 4: Total Canteen Revenue KPI
**Purpose:** Computes cumulative gross revenue for display on the staff dashboard KPI card.
```python
total_revenue = list(orders.aggregate([
    {"$match": {"status": {"$ne": "Cancelled"}}},
    {"$group": {"_id": None, "revenue": {"$sum": "$total"}}}
]))
revenue = total_revenue[0]["revenue"] if total_revenue else 0
```

---

## 7. Web Application Routes & Features

| Route | Method | Access | Description |
|---|---|---|---|
| `/` | `GET` | Public | **Home Page:** Hero banner, quick value props, and 4 popular menu items. |
| `/menu` | `GET` | Public | **Food Menu:** Catalog with real-time text search and category filter tabs (`All`, `Snacks`, `Meals`, `Beverages`). |
| `/cart` | `GET` | Public | **Cart & Checkout:** Displays items stored in `localStorage`, quantity controls, order summary, and student checkout form. |
| `/place-order` | `POST` | Public | **Order Processing:** Validates student details and payment mode, performs server-side price lookups against MongoDB, and writes order document. |
| `/orders` | `GET` | Public | **Order History & Tracking:** Chronological list of orders with student name search (`?student=...`) and client-side status filter pills. |
| `/admin` | `GET` | Staff | **Admin Dashboard:** Real-time KPI statistics cards, inventory manager table, order status updater, and visual aggregation charts. |
| `/add-item` | `POST` | Staff | **Menu Insertion:** Form action to add a new food item with validation flash alerts. |
| `/delete-item/<id>`| `POST` | Staff | **Menu Deletion:** Removes an item from the menu catalog with a confirmation guard. |
| `/update-status/<id>`| `POST` | Staff | **Status Updater:** Transitions an order between `Pending`, `Preparing`, `Completed`, and `Cancelled`. |
| `/sales` | `GET` | Staff / API | **Analytics API:** Returns JSON containing aggregation outputs for categories, payment modes, and top students. |

---

## 8. Project Structure

```
CanteenManagementSystem/
│
├── app.py                     # Main Flask application, routes, schema validators, & MongoDB pipelines
├── requirements.txt           # Python dependencies (Flask, pymongo)
├── README.md                  # Comprehensive project documentation
│
├── templates/                 # Jinja2 HTML templates
│   ├── base.html              # Core layout template with navbar, mobile toggle, & footer
│   ├── index.html             # Landing page with popular item highlights
│   ├── menu.html              # Full menu with instant search & category tabs
│   ├── cart.html              # Shopping cart and student checkout form
│   ├── orders.html            # Customer order history and status tracking
│   └── admin.html             # Staff dashboard, inventory manager, & aggregation reports
│
└── static/                    # Frontend assets
    ├── css/
    │   └── style.css          # Modern custom CSS design system
    └── js/
        └── script.js          # Cart logic, instant filters, and analytics loader
```

---

## 9. Installation & Running Instructions

### Prerequisites
1. **Python 3.8+** installed on your system.
2. **MongoDB Community Server** installed and running on `localhost:27017` (or verify via MongoDB Compass).

### Step-by-Step Setup

1. **Clone the Repository & Navigate to Project:**
   ```bash
   git clone https://github.com/Princemishti/mongoDB-Project.git
   cd mongoDB-Project
   ```

2. **(Optional) Create and activate a Virtual Environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Verify MongoDB Service is Running:**
   - On Windows:
     ```powershell
     net start MongoDB
     ```
   - Or open **MongoDB Compass** and connect to: `mongodb://localhost:27017/`

5. **Start the Flask Application:**
   ```bash
   python app.py
   ```

6. **Open in Your Browser:**
   - **Student Home / Menu:** [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
   - **Food Catalog:** [http://127.0.0.1:5000/menu](http://127.0.0.1:5000/menu)
   - **Order History:** [http://127.0.0.1:5000/orders](http://127.0.0.1:5000/orders)
   - **Staff Dashboard:** [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)
   - **Raw Aggregation JSON:** [http://127.0.0.1:5000/sales](http://127.0.0.1:5000/sales)

---

## 10. Security & Data Integrity Measures

1. **Server-Side Price Verification:**  
   The application does not trust prices sent by the client browser. During `POST /place-order`, each item's `_id` is queried directly from MongoDB to fetch its genuine unit price, recalculating `subtotal` and `total` securely on the server.
2. **Strict Schema Constraints:**  
   MongoDB `$jsonSchema` prevents dirty writes, ensuring negative prices, non-whitelisted categories, or empty orders cannot be inserted even if an external tool bypasses the frontend form.
3. **Safe ObjectId Handling:**  
   All route parameters and item IDs convert through `bson.errors.InvalidId` try-except blocks, preventing injection attacks or application crashes on malformed identifiers.
4. **Resilient Startup & Idempotency:**  
   `create_collection_if_missing` ensures existing collections and their validation rules are preserved across app restarts without raising collection-already-exists errors.

---

## 11. Academic Viva & Interview Questions

1. **Why is MongoDB preferred over MySQL/PostgreSQL for this canteen system?**  
   *Answer:* In an order management system, an order naturally contains a variable-length list of ordered items. In a relational database, this requires a parent `orders` table and a child `order_items` table linked with foreign keys, requiring multi-table JOINs for every read. In MongoDB, items are embedded in a single BSON document, retrieving the entire receipt in one atomic, low-latency read operation.
2. **What is the Snapshot Pattern and why is it used in the `orders` collection?**  
   *Answer:* When a student buys a Samosa for ₹15, the price is copied directly into the order document. If the canteen staff later raises the price to ₹20 in the `menu` collection, past order records and accounting reports must remain unaltered.
3. **What is the purpose of `$unwind` in the category revenue pipeline?**  
   *Answer:* The `$items` field is an array of sub-documents. The `$unwind` stage deconstructs the array, outputting a separate stream document for each item in the array so that `$group` can aggregate revenue by `$items.category`.
4. **What happens when an invalid document is inserted into MongoDB with `$jsonSchema` configured?**  
   *Answer:* Because `validationAction` is set to `"error"`, MongoDB immediately rejects the write and raises a `pymongo.errors.WriteError`, preventing invalid or malformed data from entering the database.
5. **How does MongoDB index optimization benefit this system?**  
   *Answer:* An index on `orders.date` enables descending sorting for recent orders without performing an in-memory sort, and an index on `student` speeds up order search queries.
