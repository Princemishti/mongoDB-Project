/**
 * Campus Canteen Management System
 * Front-end interactivity and cart management
 */

// ----------------------------------------------------
// CART MANAGEMENT (Stored in LocalStorage: canteenCart)
// ----------------------------------------------------

function getCart() {
    try {
        return JSON.parse(localStorage.getItem("canteenCart")) || [];
    } catch (e) {
        console.error("Error reading cart from localStorage", e);
        return [];
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem("canteenCart", JSON.stringify(cart));
    } catch (e) {
        console.error("Error saving cart to localStorage", e);
    }
    updateCartBadge();
}

// Add item to cart
function addToCart(id, name, price, category) {
    let cart = getCart();
    let existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({
            id: String(id),
            name: name,
            price: Number(price),
            category: category,
            qty: 1
        });
    }

    saveCart(cart);
    showToast(`🛒 ${name} added to cart!`, "success");
}

// Update cart counter in header across all pages
function updateCartBadge() {
    const badge = document.getElementById("nav-cart-count");
    if (!badge) return;

    const cart = getCart();
    const count = cart.reduce((total, item) => total + (item.qty || 1), 0);
    badge.textContent = count;

    if (count > 0) {
        badge.classList.add("visible");
        badge.classList.remove("badge-pulse");
        void badge.offsetWidth; // Trigger reflow for animation
        badge.classList.add("badge-pulse");
    } else {
        badge.classList.remove("visible");
    }
}

// Display cart items on /cart page
function displayCart() {
    const cartContainer = document.getElementById("cart-items");
    const cartTotalEl = document.getElementById("cart-total");
    const cartSubtotalEl = document.getElementById("cart-subtotal");
    const checkoutSidebar = document.getElementById("cart-sidebar");
    const clearCartBtn = document.getElementById("btn-clear-cart");

    if (!cartContainer) return;

    let cart = getCart();
    let total = 0;

    cartContainer.innerHTML = "";

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-state cart-empty">
                <span class="empty-icon">🛒</span>
                <h3>Your cart is empty</h3>
                <p>Looks like you haven't added anything to your cart yet. Explore our delicious campus menu!</p>
                <a href="/menu" class="btn btn-primary">Browse Food Menu</a>
            </div>
        `;

        if (cartTotalEl) cartTotalEl.textContent = "Total: ₹0";
        if (cartSubtotalEl) cartSubtotalEl.textContent = "₹0";
        if (checkoutSidebar) {
            checkoutSidebar.classList.add("disabled-checkout");
            const btn = document.getElementById("place-order-btn");
            if (btn) btn.disabled = true;
        }
        if (clearCartBtn) clearCartBtn.style.display = "none";
        return;
    }

    if (checkoutSidebar) {
        checkoutSidebar.classList.remove("disabled-checkout");
        const btn = document.getElementById("place-order-btn");
        if (btn) btn.disabled = false;
    }
    if (clearCartBtn) clearCartBtn.style.display = "inline-flex";

    cart.forEach((item, index) => {
        let subtotal = item.price * item.qty;
        total += subtotal;

        let row = document.createElement("div");
        row.className = "cart-row";

        let categoryTag = item.category ? `<span class="category-pill-sm">${item.category}</span>` : "";

        row.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-title">
                    <strong>${escapeHtml(item.name)}</strong>
                    ${categoryTag}
                </div>
                <div class="cart-item-unit-price">₹${item.price} each</div>
            </div>

            <div class="cart-item-actions">
                <div class="qty-stepper">
                    <button type="button" class="stepper-btn btn-minus" aria-label="Decrease quantity" onclick="changeQuantity(${index}, -1)">−</button>
                    <span class="stepper-qty">${item.qty}</span>
                    <button type="button" class="stepper-btn btn-plus" aria-label="Increase quantity" onclick="changeQuantity(${index}, 1)">+</button>
                </div>

                <div class="cart-item-subtotal">₹${subtotal}</div>

                <button type="button" class="cart-remove-btn" title="Remove item" onclick="removeItem(${index})">
                    🗑️
                </button>
            </div>
        `;

        cartContainer.appendChild(row);
    });

    if (cartTotalEl) cartTotalEl.textContent = "Total: ₹" + total;
    if (cartSubtotalEl) cartSubtotalEl.textContent = "₹" + total;
}

// Change item quantity
function changeQuantity(index, change) {
    let cart = getCart();
    if (!cart[index]) return;

    cart[index].qty += change;

    if (cart[index].qty <= 0) {
        const removed = cart.splice(index, 1)[0];
        showToast(`Removed ${removed.name} from cart`, "info");
    }

    saveCart(cart);
    displayCart();
}

// Remove item
function removeItem(index) {
    let cart = getCart();
    if (!cart[index]) return;

    let removed = cart.splice(index, 1)[0];
    saveCart(cart);
    displayCart();
    showToast(`Removed ${removed.name} from cart`, "info");
}

// Clear all items in cart
function clearCart() {
    let cart = getCart();
    if (cart.length === 0) return;

    if (confirm("Are you sure you want to clear your cart?")) {
        localStorage.removeItem("canteenCart");
        saveCart([]);
        displayCart();
        showToast("Cart cleared", "info");
    }
}

// Place order
async function placeOrder() {
    const studentInput = document.getElementById("student-name");
    const paymentSelect = document.getElementById("payment-method");
    const placeBtn = document.getElementById("place-order-btn");

    if (!studentInput || !paymentSelect) return;

    let student = studentInput.value.trim();
    let payment = paymentSelect.value;
    let cart = getCart();

    if (!student) {
        showToast("Please enter your name to place the order.", "error");
        studentInput.focus();
        return;
    }

    if (cart.length === 0) {
        showToast("Your cart is empty. Add items before ordering.", "error");
        return;
    }

    let orderData = {
        student: student,
        payment: payment,
        items: cart.map(item => ({
            id: item.id,
            qty: item.qty
        }))
    };

    if (placeBtn) {
        placeBtn.disabled = true;
        placeBtn.innerHTML = `<span class="spinner"></span> Placing Order...`;
    }

    try {
        let response = await fetch("/place-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(orderData)
        });

        let result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Unable to place order.", "error");
            if (placeBtn) {
                placeBtn.disabled = false;
                placeBtn.innerHTML = `<span class="btn-icon">✓</span> Place Order Now`;
            }
            return;
        }

        // Success: Clear cart
        localStorage.removeItem("canteenCart");
        updateCartBadge();

        showToast(`🎉 Order Placed! Order ID: ${result.order_id}`, "success");

        // Short smooth transition to order history
        setTimeout(() => {
            window.location.href = "/orders?student=" + encodeURIComponent(student);
        }, 900);

    } catch (error) {
        showToast("Unable to connect to the server. Please try again.", "error");
        console.error("Order placement error:", error);
        if (placeBtn) {
            placeBtn.disabled = false;
            placeBtn.innerHTML = `<span class="btn-icon">✓</span> Place Order Now`;
        }
    }
}

// ----------------------------------------------------
// TOAST NOTIFICATION SYSTEM
// ----------------------------------------------------

function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    else if (type === "error") icon = "⚠️";
    else if (type === "info") icon = "ℹ️";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button type="button" class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Auto remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ----------------------------------------------------
// CLIENT-SIDE FILTERING FOR /menu PAGE
// ----------------------------------------------------

function initMenuFilters() {
    const searchInput = document.getElementById("menu-search-input");
    const clearBtn = document.getElementById("menu-search-clear");
    const tabs = document.querySelectorAll("#category-tabs .tab-btn");
    const foodCards = document.querySelectorAll("#menu-food-grid .food-card");
    const resultsCount = document.getElementById("results-count");
    const noResults = document.getElementById("no-filter-results");

    if (!searchInput && tabs.length === 0) return;

    let activeCategory = "all";
    let searchQuery = "";

    function filterMenu() {
        let visibleCount = 0;

        foodCards.forEach(card => {
            const name = card.getAttribute("data-name") || "";
            const category = card.getAttribute("data-category") || "";

            const matchesCategory = (activeCategory === "all") || (category.toLowerCase() === activeCategory.toLowerCase());
            const matchesSearch = (!searchQuery) || (name.includes(searchQuery));

            if (matchesCategory && matchesSearch) {
                card.style.display = "flex";
                visibleCount++;
            } else {
                card.style.display = "none";
            }
        });

        if (resultsCount) {
            resultsCount.textContent = `Showing ${visibleCount} of ${foodCards.length} items`;
        }

        if (noResults) {
            noResults.style.display = (visibleCount === 0 && foodCards.length > 0) ? "block" : "none";
        }

        if (clearBtn) {
            clearBtn.style.display = searchQuery ? "inline-flex" : "none";
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            filterMenu();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            searchQuery = "";
            filterMenu();
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeCategory = tab.getAttribute("data-category") || "all";
            filterMenu();
        });
    });

    window.resetMenuFilters = function() {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        activeCategory = "all";
        tabs.forEach(t => {
            if (t.getAttribute("data-category") === "all") t.classList.add("active");
            else t.classList.remove("active");
        });
        filterMenu();
    };
}

// ----------------------------------------------------
// CLIENT-SIDE FILTERING FOR /orders PAGE
// ----------------------------------------------------

function initOrderFilters() {
    const pills = document.querySelectorAll("#order-status-filters .pill-btn");
    const orderCards = document.querySelectorAll("#orders-list .order-card");

    if (pills.length === 0 || orderCards.length === 0) return;

    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const filterStatus = pill.getAttribute("data-status");

            orderCards.forEach(card => {
                const status = card.getAttribute("data-status");
                if (filterStatus === "all" || status.toLowerCase() === filterStatus.toLowerCase()) {
                    card.style.display = "block";
                } else {
                    card.style.display = "none";
                }
            });
        });
    });
}

// ----------------------------------------------------
// ADMIN DASHBOARD SALES ANALYTICS LOADER
// ----------------------------------------------------

async function loadAdminAnalytics() {
    const catContainer = document.getElementById("category-sales-report");
    const payContainer = document.getElementById("payment-sales-report");
    const stuContainer = document.getElementById("top-students-report");

    if (!catContainer && !payContainer && !stuContainer) return;

    try {
        const response = await fetch("/sales");
        if (!response.ok) throw new Error("Failed to load sales data");
        const data = await response.json();

        // 1. Category Sales
        if (catContainer) {
            const categories = data.category_sales || [];
            if (categories.length === 0) {
                catContainer.innerHTML = `<p class="text-muted">No completed order sales yet.</p>`;
            } else {
                let maxRev = Math.max(...categories.map(c => c.revenue || 1));
                let html = `<div class="analytics-list">`;
                categories.forEach(cat => {
                    const pct = Math.round((cat.revenue / maxRev) * 100);
                    html += `
                        <div class="analytics-row">
                            <div class="row-header">
                                <span class="row-label"><strong>${cat._id || 'Uncategorized'}</strong></span>
                                <span class="row-value font-bold">₹${cat.revenue}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill fill-accent" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
                catContainer.innerHTML = html;
            }
        }

        // 2. Payment Sales
        if (payContainer) {
            const payments = data.payment_sales || [];
            if (payments.length === 0) {
                payContainer.innerHTML = `<p class="text-muted">No payment data recorded yet.</p>`;
            } else {
                let html = `<div class="analytics-list">`;
                payments.forEach(pay => {
                    let icon = "💳";
                    if (pay._id === "UPI") icon = "📱";
                    else if (pay._id === "Cash") icon = "💵";

                    html += `
                        <div class="analytics-pill-row">
                            <div class="pill-left">
                                <span class="pay-icon">${icon}</span>
                                <div>
                                    <strong>${pay._id || 'Other'}</strong>
                                    <span class="sub-count">${pay.total_orders} orders</span>
                                </div>
                            </div>
                            <div class="pill-right">
                                <span class="pill-amount">₹${pay.total_sales}</span>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
                payContainer.innerHTML = html;
            }
        }

        // 3. Top Students
        if (stuContainer) {
            const students = data.top_students || [];
            if (students.length === 0) {
                stuContainer.innerHTML = `<p class="text-muted">No student spending records yet.</p>`;
            } else {
                let html = `<div class="analytics-list">`;
                students.forEach((stu, idx) => {
                    const medal = idx === 0 ? "🥇" : "🥈";
                    html += `
                        <div class="analytics-pill-row">
                            <div class="pill-left">
                                <span class="medal-icon">${medal}</span>
                                <div>
                                    <strong>${escapeHtml(stu._id || 'Unknown')}</strong>
                                    <span class="sub-count">Top Customer #${idx + 1}</span>
                                </div>
                            </div>
                            <div class="pill-right">
                                <span class="pill-amount text-success font-bold">₹${stu.total_spent}</span>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
                stuContainer.innerHTML = html;
            }
        }

    } catch (err) {
        console.error("Sales analytics load failed", err);
        if (catContainer) catContainer.innerHTML = `<p class="text-error">Unable to load category report.</p>`;
        if (payContainer) payContainer.innerHTML = `<p class="text-error">Unable to load payment report.</p>`;
        if (stuContainer) stuContainer.innerHTML = `<p class="text-error">Unable to load student report.</p>`;
    }
}

// ----------------------------------------------------
// MOBILE NAVIGATION TOGGLE
// ----------------------------------------------------

function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");

    if (toggle && links) {
        toggle.addEventListener("click", () => {
            links.classList.toggle("open");
            toggle.classList.toggle("active");
        });
    }
}

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    displayCart();
    initMenuFilters();
    initOrderFilters();
    loadAdminAnalytics();
    initMobileNav();
});
