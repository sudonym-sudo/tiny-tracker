<script>
  let {
    type = "output",
    name = "",
    id = "",
    nodeId = "",
    connected = false,
    onconnect,
  } = $props();

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
    margin: 6px 0;
    font-size: 0.7rem;
    color: var(--text-dim);
    position: relative; /* Allow absolute positioning of port circle */
    min-height: 14px;
  }
  .port {
    width: 12px;
    height: 12px;
    background: #1c1c1e;
    border: 1px solid #333;
    border-radius: 50%;
    cursor: crosshair;
    z-index: 2;
    position: absolute;
  }
  .input .port {
    left: -24px; /* Pull out to the node edge (18px node padding + 6px extra) */
  }
  .output .port {
    right: -24px;
  }
  .port.connected {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
  .input {
    justify-content: flex-start;
    padding-left: 2px;
  }
  .output {
    justify-content: flex-end;
    padding-right: 2px;
  }
  .label {
    white-space: nowrap;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.55rem;
    letter-spacing: 0.05em;
  }
</style>
