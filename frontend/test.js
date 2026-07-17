fetch("http://localhost:5001/api/platform-admin/tenants/123", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ownerPassword: "newpassword" })
}).then(r => r.text()).then(console.log).catch(console.error);
