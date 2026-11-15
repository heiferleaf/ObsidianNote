export default ""
document.addEventListener("nav", () => {
  const home = document.querySelector<HTMLElement>(".home-page")
  if (!home) return
  const search = home.querySelector<HTMLButtonElement>(".home-search-launch")
  const openSearch = () => document.querySelector<HTMLButtonElement>(".sidebar.left .search-button")?.click()
  search?.addEventListener("click", openSearch)
  const buttons = [...home.querySelectorAll<HTMLButtonElement>("[data-topic-filter]")]
  const cards = [...home.querySelectorAll<HTMLElement>(".topic-card")]
  const handlers = buttons.map((button) => {
    const apply = () => {
      const category = button.dataset.topicFilter
      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)))
      let count = 0
      cards.forEach((card) => { card.hidden = category !== "all" && card.dataset.category !== category; if (!card.hidden) count++ })
      const result = home.querySelector(".directory-result")
      if (result) result.textContent = `${category === "all" ? "全部" : category} ${count} 个专题`
    }
    button.addEventListener("click", apply)
    return () => button.removeEventListener("click", apply)
  })
  window.addCleanup(() => { search?.removeEventListener("click", openSearch); handlers.forEach((dispose) => dispose()) })
})
