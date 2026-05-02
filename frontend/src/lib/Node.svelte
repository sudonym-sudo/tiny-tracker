<script>
  let {
    node,
    isSelected = false,
    children,
    onmove,
    onsave,
    onselect,
    ondelete,
  } = $props();

  let dragging = $state(false);
  let startX = 0;
  let startY = 0;

  function onMouseDown(e) {
    if (
      e.target.closest(".port") ||
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("textarea")
    )
      return;
    dragging = true;
    startX = e.clientX - node.json.x;
    startY = e.clientY - node.json.y;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    onselect?.();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    node.json.x = e.clientX - startX;
    node.json.y = e.clientY - startY;
    onmove?.({ id: node.id, x: node.json.x, y: node.json.y });
  }

  function onMouseUp() {
    if (dragging) {
      dragging = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      onsave?.(node);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="node {node.type}"
  style="transform: translate({node.json.x}px, {node.json
    .y}px); border-color: {isSelected ? 'var(--border-bright)' : 'var(--border-dim)'}"
  onmousedown={onMouseDown}
>
  <div class="header">
    <span class="type">{node.type}</span>
    <button class="delete" onclick={() => ondelete?.(node.id)}>×</button>
  </div>
  <div class="content">
    {@render children?.()}
  </div>
</div>

<style>
  .node {
    position: absolute;
    width: 210px;
    background: var(--bg-node);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius);
    user-select: none;
    z-index: 10;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .node.isSelected {
    border-color: #333;
    box-shadow: 0 0 0 2px var(--color-primary);
  }

  .header {
    padding: 14px 18px 8px 18px;
    background: var(--bg-header);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: grab;
  }
  .header:active {
    cursor: grabbing;
  }
  .type {
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: capitalize;
    color: var(--text-dim);
    letter-spacing: -0.01em;
  }
  .content {
    padding: 8px 18px 18px 18px;
  }
  .delete {
    background: var(--color-gray-dark);
    border: none;
    color: var(--text-main);
    cursor: pointer;
    font-size: 0.7rem;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }
</style>
