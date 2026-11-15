export default ""

document.addEventListener("nav", () => {
  const menu = document.querySelector<HTMLDetailsElement>(".topic-menu")
  if (!menu) return
  const desktop = window.matchMedia("(min-width: 801px)")
  const setExpanded = () => {
    menu.open = desktop.matches
  }
  const keepDesktopExpanded = (event: Event) => {
    if (desktop.matches) event.preventDefault()
  }
  const summary = menu.querySelector("summary")!
  setExpanded()
  desktop.addEventListener("change", setExpanded)
  summary.addEventListener("click", keepDesktopExpanded)
  window.addCleanup(() => {
    desktop.removeEventListener("change", setExpanded)
    summary.removeEventListener("click", keepDesktopExpanded)
  })
})
