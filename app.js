// ======================================
// EJL WATER STATION - JAVASCRIPT
// ======================================

let orders = JSON.parse(localStorage.getItem("ejlOrders")) || [];
let orderFilter = "All";

function saveData() {
    localStorage.setItem("ejlOrders", JSON.stringify(orders));
}

function formatMoney(amount) {
    return "₱" + Number(amount).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
}

function toast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function badges(order) {
    return `<div class="tags">
        <span class="tag ${order.status === "Delivered" ? "t-done" : "t-pend"}">${escapeHTML(order.status)}</span>
        <span class="tag ${order.payment === "Paid" ? "t-done" : "t-bad"}">${escapeHTML(order.payment)}</span>
    </div>`;
}

// ======================================
// PAGE NAVIGATION
// ======================================

const pageInfo = {
    dashboard: ["Dashboard", "Overview of the entire water station"],
    orders: ["Customer Orders", "All customer orders"],
    map: ["Delivery Map", "Track your deliveries"],
    customers: ["Customer List", "Your regular customers"],
    payments: ["Credits & Payments", "Payments and outstanding credits"]
};

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    const page = document.getElementById(pageId);
    if (page) page.classList.remove("hidden");

    document.querySelectorAll(".sidebar nav button").forEach(b =>
        b.classList.toggle("on", b.dataset.page === pageId));

    const info = pageInfo[pageId] || ["EJL WATER STATION", ""];
    document.querySelector("header h1").textContent = info[0];
    document.getElementById("subtitle").textContent = info[1];

    displayAll();
    if (pageId === "map") refreshMap();
}

// ======================================
// NEW ORDER (modal form)
// ======================================

const dialog = document.getElementById("orderDialog");
const form = document.getElementById("orderForm");

function openOrderForm() {
    form.reset();
    updateFormTotal();
    dialog.showModal();
}

function closeOrderForm() {
    dialog.close();
}

function updateFormTotal() {
    const g = Number(form.gallons.value) || 0;
    const p = Number(form.price.value) || 0;
    document.getElementById("formTotal").textContent = "Total: " + formatMoney(g * p);
}

form.addEventListener("input", updateFormTotal);

form.addEventListener("submit", function (e) {
    e.preventDefault();
    const gallons = Number(form.gallons.value);
    const price = Number(form.price.value);

    if (!Number.isInteger(gallons) || gallons < 1 || !(price > 0)) {
        toast("Please enter valid gallons and price.");
        return;
    }

    orders.push({
        id: Date.now(),
        customer: form.customer.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        gallons: gallons,
        price: price,
        amount: gallons * price,
        status: "Pending",
        payment: "Unpaid",
        date: new Date().toLocaleDateString("en-PH")
    });

    saveData();
    closeOrderForm();
    displayAll();
    if (!document.getElementById("map").classList.contains("hidden")) refreshMap();
    toast("Order successfully added!");
});

// ======================================
// ORDERS
// ======================================

document.getElementById("orderChips").addEventListener("click", function (e) {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    orderFilter = chip.dataset.f;
    document.querySelectorAll("#orderChips .chip").forEach(c => c.classList.toggle("on", c === chip));
    displayOrders();
});

function displayOrders() {
    const list = document.getElementById("orderList");
    if (!list) return;

    const filtered = orders.filter(o =>
        orderFilter === "All" ||
        (orderFilter === "Unpaid" ? o.payment === "Unpaid" : o.status === orderFilter));

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty">No customer orders yet.</p>';
        return;
    }

    list.innerHTML = filtered.slice().reverse().map(order => `
        <div class="card has-jug">
            ${jug(order.gallons)}
            <div class="top"><h3>${escapeHTML(order.customer)}</h3>${badges(order)}</div>
            <p>${PHONE_ICON}${escapeHTML(order.phone) || "—"}</p>
            <p>${PIN_ICON}${escapeHTML(order.address)}</p>
            <p>${order.gallons} gallons × ${formatMoney(order.price)} · ${escapeHTML(order.date)}</p>
            <div class="money">${formatMoney(order.amount)}</div>
            <div class="acts">
                ${order.status !== "Delivered" ? `<button class="btn sm" onclick="markDelivered(${order.id})">Mark Delivered</button>` : ""}
                ${order.payment !== "Paid" ? `<button class="btn sm ghost" onclick="markPaid(${order.id})">Mark Paid</button>` : ""}
                <button class="btn sm danger" onclick="deleteOrder(${order.id})">Delete</button>
            </div>
        </div>
    `).join("");
}

function markDelivered(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    order.status = "Delivered";
    saveData();
    displayAll();
    refreshMap();
    toast("Marked as delivered");
}

function markPaid(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    order.payment = "Paid";
    saveData();
    displayAll();
    toast("Payment successfully recorded!");
}

function deleteOrder(id) {
    if (!confirm("Are you sure you want to delete this order?")) return;
    orders = orders.filter(o => o.id !== id);
    saveData();
    displayAll();
    refreshMap();
}

// ======================================
// DASHBOARD
// ======================================

function updateDashboard() {
    const sum = list => list.reduce((s, o) => s + o.amount, 0);
    document.getElementById("totalOrders").textContent = orders.length;
    document.getElementById("totalSales").textContent = formatMoney(sum(orders.filter(o => o.payment === "Paid")));
    document.getElementById("pendingOrders").textContent = orders.filter(o => o.status === "Pending").length;
    document.getElementById("totalDebt").textContent = formatMoney(sum(orders.filter(o => o.payment === "Unpaid")));

    const paidAmt = sum(orders.filter(o => o.payment === "Paid"));
    const debtAmt = sum(orders.filter(o => o.payment === "Unpaid"));
    document.getElementById("collectBar").style.width = (paidAmt + debtAmt ? Math.round(paidAmt / (paidAmt + debtAmt) * 100) : 0) + "%";
    document.getElementById("barPaid").textContent = formatMoney(paidAmt) + " paid";
    document.getElementById("barDebt").textContent = formatMoney(debtAmt) + " outstanding";

    const recent = document.getElementById("recentList");
    recent.innerHTML = orders.length === 0
        ? '<p class="empty">No orders yet. Tap "+ New Order" to get started.</p>'
        : orders.slice(-5).reverse().map(o => `
            <div class="row-item">
                <div class="av">${escapeHTML(o.customer.charAt(0).toUpperCase())}</div>
                <div class="info"><b>${escapeHTML(o.customer)}</b><small>${o.gallons} gallons · ${escapeHTML(o.date)}</small></div>
                <b>${formatMoney(o.amount)}</b>
                ${badges(o)}
            </div>`).join("");
}

// ======================================
// CUSTOMER LIST
// ======================================

function displayCustomers() {
    const list = document.getElementById("customerList");
    if (!list) return;

    const customers = {};
    orders.forEach(o => {
        const key = o.phone || o.customer;
        if (!customers[key]) customers[key] = { name: o.customer, phone: o.phone, address: o.address, count: 0, debt: 0, orders: [] };
        customers[key].count++;
        customers[key].orders.push(o);
        if (o.payment === "Unpaid") customers[key].debt += o.amount;
    });

    const all = Object.values(customers);
    customerCache = all;
    list.innerHTML = all.length === 0
        ? '<p class="empty">No customer records yet.</p>'
        : all.map((c, i) => `
            <div class="card pcard" onclick="openProfile(${i})">
                <div class="top">
                    <div style="display:flex;gap:10px;align-items:center">
                        <div class="av">${escapeHTML(c.name.charAt(0).toUpperCase())}</div>
                        <h3>${escapeHTML(c.name)}</h3>
                    </div>
                    ${c.debt > 0 ? '<span class="tag t-bad">Has balance</span>' : '<span class="tag t-done">Clear</span>'}
                </div>
                <p>${PHONE_ICON}${escapeHTML(c.phone) || "—"}</p>
                <p>${PIN_ICON}${escapeHTML(c.address)}</p>
                <p>${c.count} order${c.count > 1 ? "s" : ""}${c.debt > 0 ? " · Balance: " + formatMoney(c.debt) : ""}</p>
            </div>`).join("");
}

// ======================================
// CREDITS AND PAYMENTS
// ======================================

function displayPayments() {
    const list = document.getElementById("paymentList");
    if (!list) return;

    const sum = arr => arr.reduce((s, o) => s + o.amount, 0);
    document.getElementById("debtSummary").textContent = formatMoney(sum(orders.filter(o => o.payment === "Unpaid")));
    document.getElementById("paidSummary").textContent = formatMoney(sum(orders.filter(o => o.payment === "Paid")));

    list.innerHTML = orders.length === 0
        ? '<p class="empty">No payment records yet.</p>'
        : orders.slice().reverse().map(o => `
            <div class="card">
                <div class="top"><h3>${escapeHTML(o.customer)}</h3>
                    <span class="tag ${o.payment === "Paid" ? "t-done" : "t-bad"}">${escapeHTML(o.payment)}</span></div>
                <div class="money">${formatMoney(o.amount)}</div>
                <p>${escapeHTML(o.date)}</p>
                ${o.payment === "Unpaid" ? `<div class="acts"><button class="btn sm" onclick="markPaid(${o.id})">Record Payment</button></div>` : ""}
            </div>`).join("");
}

// ======================================
// DISPLAY ALL
// ======================================

function displayAll() {
    updateDashboard();
    displayOrders();
    displayCustomers();
    displayPayments();
    displayMapList();
}

// ======================================
// GOOGLE MAPS
// ======================================

let map, geocoder, markers = [];

function initMap() {
    const el = document.getElementById("googleMap");
    if (!el || !window.google) return;

    map = new google.maps.Map(el, {
        center: { lat: 12.8797, lng: 121.7740 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false
    });
    geocoder = new google.maps.Geocoder();
    new google.maps.TrafficLayer().setMap(map);
    refreshMap();
}

function displayMapList() {
    const list = document.getElementById("mapList");
    if (!list) return;

    const pending = orders.filter(o => o.status === "Pending");
    list.innerHTML = pending.length === 0
        ? '<p class="empty">No pending deliveries 🎉</p>'
        : pending.map(o => `
            <div class="row-item click" onclick="focusOrder(${o.id})">
                <div class="av" style="background:var(--pend)">${escapeHTML(o.customer.charAt(0).toUpperCase())}</div>
                <div class="info"><b>${escapeHTML(o.customer)}</b><small>${escapeHTML(o.address)}</small><small>${o.gallons} gallons</small></div>
            </div>`).join("");
}

function refreshMap() {
    if (!map) {
        const el = document.getElementById("googleMap");
        if (el && !window.google) el.textContent = "Add your Google Maps API key in index.html to show the map.";
        return;
    }
    google.maps.event.trigger(map, "resize");
    markers.forEach(m => m.setMap(null));
    markers = [];

    orders.forEach((o, i) => {
        if (o.lat != null) return addMarker(o);
        // Geocode address (small delay to avoid rate limits)
        setTimeout(() => {
            geocoder.geocode({ address: o.address + ", Philippines" }, (res, status) => {
                if (status === "OK") {
                    const loc = res[0].geometry.location;
                    o.lat = loc.lat();
                    o.lng = loc.lng();
                    saveData();
                    addMarker(o);
                }
            });
        }, i * 250);
    });
}

function addMarker(o) {
    const color = o.status === "Delivered" ? "#16a34a" : "#f59e0b";
    const marker = new google.maps.Marker({
        map: map,
        position: { lat: o.lat, lng: o.lng },
        title: o.customer,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }
    });
    const info = new google.maps.InfoWindow({
        content: `<b>${escapeHTML(o.customer)}</b><br>${escapeHTML(o.address)}<br>${o.gallons} gallons · ${escapeHTML(o.status)}`
    });
    marker.addListener("click", () => info.open(map, marker));
    marker.orderId = o.id;
    marker.info = info;
    markers.push(marker);
}

function focusOrder(id) {
    const m = markers.find(x => x.orderId === id);
    if (!m || !map) return;
    map.panTo(m.getPosition());
    map.setZoom(16);
    m.info.open(map, m);
}

// ======================================
// INITIALIZE
// ======================================

document.addEventListener("DOMContentLoaded", displayAll);

// ======================================
// DESIGN HELPERS (water jug, icons, customer profile)
// ======================================

const PHONE_ICON = '<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.25 1z"/></svg>';
const PIN_ICON = '<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
let customerCache = [];

// Water jug: the water level rises with the number of gallons (full at 25)
function jug(gallons) {
    const y = 64 - Math.min(1, gallons / 25) * 42;
    const body = "M22 6h20v10l8 8c3 3 4 6 4 10v32a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V34c0-4 1-7 4-10l8-8z";
    return `<svg class="jug" width="64" height="80" viewBox="0 0 64 80" aria-hidden="true"><defs><clipPath id="jugClip"><path d="${body}"/></clipPath></defs>
        <g clip-path="url(#jugClip)"><rect width="64" height="80" fill="#d9f2f8" opacity=".5"/>
        <path d="M0 ${y} q8-6 16 0 t16 0 t16 0 t16 0 V80 H0z" fill="#12b3d3"/>
        <path d="M0 ${y + 5} q8-6 16 0 t16 0 t16 0 t16 0 V80 H0z" fill="#0a8cab" opacity=".55"/></g>
        <path d="${body}" fill="none" stroke="#0a8cab" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="24" y="1" width="16" height="6" rx="2" fill="#0a8cab"/></svg>`;
}

function openProfile(i) {
    const c = customerCache[i];
    if (!c) return;
    document.getElementById("profileBody").innerHTML = `
        <div class="pf-head">
            <div class="av lg">${escapeHTML(c.name.charAt(0).toUpperCase())}</div>
            <div><h2>${escapeHTML(c.name)}</h2>${c.debt > 0 ? '<span class="tag t-bad">Has balance</span>' : '<span class="tag t-done">Clear</span>'}</div>
        </div>
        <p>${PHONE_ICON}${escapeHTML(c.phone) || "—"}</p>
        <p>${PIN_ICON}${escapeHTML(c.address)}</p>
        <div class="pf-stats">
            <div class="stat"><span>Orders</span><b>${c.count}</b></div>
            <div class="stat"><span>Balance</span><b>${formatMoney(c.debt)}</b></div>
        </div>
        <ul class="hist">${c.orders.slice().reverse().map(o => `
            <li><span>${o.gallons} gallons · ${escapeHTML(o.date)}</span>
            <span>${formatMoney(o.amount)} <span class="tag ${o.payment === "Paid" ? "t-done" : "t-bad"}">${escapeHTML(o.payment)}</span></span></li>`).join("")}</ul>`;
    document.getElementById("profileDialog").showModal();
}

// ======================================
// COLLAPSIBLE SIDEBAR
// ======================================

function toggleSidebar() {
    const collapsed = document.body.classList.toggle("collapsed");
    try { localStorage.setItem("ejlCollapsed", collapsed ? "1" : "0"); } catch (e) {}
    setTimeout(() => { if (window.google && map) google.maps.event.trigger(map, "resize"); }, 300);
}
try { if (localStorage.getItem("ejlCollapsed") === "1") document.body.classList.add("collapsed"); } catch (e) {}