function render({ model, el }) {
  let count = () => model.get("value");
  let btn = document.createElement("button");
  btn.innerText = `Count: ${count()}`;
  btn.addEventListener("click", () => {
    model.set("value", count() + 1);
    model.save_changes();
  });
  model.on("change:value", () => {
    btn.innerHTML = `Count: ${count()}`;
  });
  el.appendChild(btn);
}

export default { render };
