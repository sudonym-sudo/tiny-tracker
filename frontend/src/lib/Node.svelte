<script>
    let { node, isSelected = false, children, onmove, onsave, onselect, ondelete } = $props();

    let dragging = $state(false);
    let startX = 0;
    let startY = 0;

    function onMouseDown(e) {
        if (e.target.closest(".port") || e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea")) return;
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
    style="transform: translate({node.json.x}px, {node.json.y}px); border-color: {isSelected ? '#007bff' : '#222'}"
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
        width: 200px;
        background: #050505;
        border: 2px solid #222;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        user-select: none;
        z-index: 10;
        display: flex;
        flex-direction: column;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .node:hover { border-color: #444; }
    .node.isSelected { box-shadow: 0 0 20px rgba(0, 123, 255, 0.2); }
    
    .header {
        padding: 6px 10px;
        background: #0a0a0a;
        border-bottom: 1px solid #1a1a1a;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        border-radius: 10px 10px 0 0;
    }
    .header:active { cursor: grabbing; }
    .type { font-weight: bold; font-size: 0.7rem; text-transform: uppercase; color: #555; letter-spacing: 0.05em; }
    .content { padding: 12px; }
    .delete {
        background: none;
        border: none;
        color: #444;
        cursor: pointer;
        font-size: 1.1rem;
        line-height: 1;
        transition: color 0.2s;
    }
    .delete:hover { color: #f44; }
</style>
