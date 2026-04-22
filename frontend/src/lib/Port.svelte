<script>
    let { type = "output", name = "", id = "", nodeId = "", connected = false, onconnect } = $props();

    function onMouseDown(e) {
        e.stopPropagation();
        onconnect?.({ type, name, id: nodeId });
    }
</script>

<div class="port-container {type}">
    {#if type === "input"}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            id="port-{nodeId}-{type}-{name}"
            class="port {connected ? 'connected' : ''}" 
            onmousedown={onMouseDown}
        ></div>
        <span class="label">{name}</span>
    {:else}
        <span class="label">{name}</span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            id="port-{nodeId}-{type}-{name}"
            class="port {connected ? 'connected' : ''}" 
            onmousedown={onMouseDown}
        ></div>
    {/if}
</div>

<style>
    .port-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 0;
        font-size: 0.65rem;
        color: #666;
        position: relative;
    }
    .port {
        width: 12px;
        height: 12px;
        background: #000;
        border: 2px solid #444;
        border-radius: 50%;
        cursor: crosshair;
        transition: all 0.2s;
        z-index: 2;
    }
    .port:hover {
        border-color: #007bff;
        box-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
        transform: scale(1.2);
    }
    .port.connected {
        background: #28a745;
        border-color: #1e7e34;
        box-shadow: 0 0 8px rgba(40, 167, 69, 0.4);
    }
    .input { justify-content: flex-start; margin-left: -18px; }
    .output { justify-content: flex-end; margin-right: -18px; }
    .label { white-space: nowrap; font-weight: bold; }
</style>
