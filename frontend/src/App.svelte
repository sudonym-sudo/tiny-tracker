<script>
  import { onMount, tick } from "svelte";
  import Node from "./lib/Node.svelte";
  import Port from "./lib/Port.svelte";
  import { Plus, Trash2, Grid, Settings2, Target } from "lucide-svelte";

  let nodes = $state([]);
  let edges = $state([]);
  let connecting = $state(null);
  let selectingCell = $state(null); // { nodeId, outputIdx }

  const API_URL = "/api";
  let canvasEl = $state();

  // -------------------- DATA FETCHING -------------------- //

  async function fetchData() {
    const [nRes, eRes] = await Promise.all([
      fetch(`${API_URL}/nodes`),
      fetch(`${API_URL}/edges`),
    ]);
    nodes = await nRes.json();
    edges = await eRes.json();
  }

  async function saveNode(node) {
    await fetch(`${API_URL}/nodes/${node.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: node.json }),
    });
  }

  async function spawnNode(type) {
    let json = { x: 100, y: 100 };
    if (type === "number") json = { ...json, value: 0, input: null };
    if (type === "note") json = { ...json, text: "" };
    if (type === "equation")
      json = {
        ...json,
        formula: "",
        a: 0,
        b: 0,
        result: 0,
        tokens: [],
        error: null,
      };
    if (type === "table") {
      json = {
        ...json,
        cols: [{ id: "c1", name: "Val" }],
        rows: [],
        buffer: { c1: 0 },
        outputs: [{ name: "out", r: 0, c: "c1" }],
      };
    }

    const r = await fetch(`${API_URL}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, json }),
    });
    if (r.ok) fetchData();
  }

  async function deleteNode(id) {
    await fetch(`${API_URL}/nodes/${id}`, { method: "DELETE" });
    fetchData();
  }

  // -------------------- CONNECTION LOGIC -------------------- //

  function startConnect(nodeId, type, name) {
    if (!connecting) {
      connecting = { nodeId, type, name };
    } else {
      if (connecting.nodeId !== nodeId && connecting.type !== type) {
        createEdge(connecting, { nodeId, type, name });
      }
      connecting = null;
    }
  }

  async function createEdge(source, target) {
    const s = source.type === "output" ? source : target;
    const t = source.type === "input" ? source : target;

    await fetch(`${API_URL}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: s.nodeId,
        target_id: t.nodeId,
        source_port: s.name,
        target_port: t.name,
      }),
    });
    fetchData();
  }

  async function deleteEdge(id) {
    await fetch(`${API_URL}/edges/${id}`, { method: "DELETE" });
    fetchData();
  }

  // -------------------- ENGINE & LOGIC -------------------- //

  $effect(() => {
    nodes.forEach((node) => {
      const inputs = edges.filter((e) => e.target_id === node.id);

      if (node.type === "number") {
        const conn = inputs.find((e) => e.target_port === "in");
        if (conn) {
          node.json.input = getOutput(
            nodes.find((n) => n.id === conn.source_id),
            conn.source_port,
          );
          node.json.value = node.json.input;
        } else node.json.input = null;
      }

      if (node.type === "equation") {
        const connA = inputs.find((e) => e.target_port === "a");
        const connB = inputs.find((e) => e.target_port === "b");
        if (connA)
          node.json.a = getOutput(
            nodes.find((n) => n.id === connA.source_id),
            connA.source_port,
          );
        if (connB)
          node.json.b = getOutput(
            nodes.find((n) => n.id === connB.source_id),
            connB.source_port,
          );
        try {
          node.json.result = evaluateEquation(
            node.json.formula,
            node.json.a,
            node.json.b,
          );
          node.json.error = null;
          node.json.tokens = tokenize(node.json.formula);
        } catch (e) {
          node.json.error = e.message;
        }
      }

      if (node.type === "table") {
        node.json.cols.forEach((col) => {
          const conn = inputs.find((e) => e.target_port === col.id);
          if (conn) {
            node.json.buffer[col.id] = getOutput(
              nodes.find((n) => n.id === conn.source_id),
              conn.source_port,
            );
          }
        });
      }
    });
  });

  function getOutput(node, portName) {
    if (!node) return 0;
    if (node.type === "number") return node.json.value;
    if (node.type === "equation") return node.json.result;
    if (node.type === "table") {
      const outDef = node.json.outputs.find((o) => o.name === portName);
      if (!outDef) return 0;
      const row = node.json.rows[outDef.r];
      return row ? row[outDef.c] || 0 : 0;
    }
    return 0;
  }

  function tokenize(formula) {
    if (!formula) return [];
    const tokens = [];
    let i = 0;
    while (i < formula.length) {
      const char = formula[i];
      if (/\d/.test(char)) {
        let num = "";
        while (i < formula.length && /[\d.]/.test(formula[i]))
          num += formula[i++];
        tokens.push({ type: "number", value: num });
        continue;
      }
      if (/[ab]/.test(char)) tokens.push({ type: "variable", value: char });
      else if (/[\+\-\*\/\%\^]/.test(char)) {
        if (char === "^" && formula[i + 1] && !/[\dab]/.test(formula[i + 1]))
          throw new Error("'^' must be followed by number or variable");
        tokens.push({ type: "operator", value: char });
      }
      i++;
    }
    return tokens;
  }

  function evaluateEquation(formula, a, b) {
    if (!formula) return 0;
    let f = formula
      .replace(/(\d)([ab])/g, "$1*$2")
      .replace(/([ab])([ab])/g, "$1*$2");
    const safeFormula = f
      .replace(/a/g, `(${a})`)
      .replace(/b/g, `(${b})`)
      .replace(/\^/g, "**");
    try {
      return eval(safeFormula) || 0;
    } catch {
      return 0;
    }
  }

  // -------------------- UI & PRECISION -------------------- //

  function getPortPos(nodeId, portName, type) {
    const id = `port-${nodeId}-${type}-${portName}`;
    const el = document.getElementById(id);
    if (!el || !canvasEl) return { x: 0, y: 0 };

    const rect = el.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();

    return {
      x: rect.left - canvasRect.left + rect.width / 2 + canvasEl.scrollLeft,
      y: rect.top - canvasRect.top + rect.height / 2 + canvasEl.scrollTop,
    };
  }

  // -------------------- TABLE ACTIONS -------------------- //

  function addTableCol(node) {
    const id = "c" + (node.json.cols.length + 1);
    node.json.cols.push({ id, name: "New" });
    node.json.buffer[id] = 0;
    node.json.rows.forEach((r) => (r[id] = 0));
    saveNode(node);
  }

  function addTableOutput(node) {
    const name = "out" + (node.json.outputs.length + 1);
    node.json.outputs.push({ name, r: 0, c: node.json.cols[0].id });
    saveNode(node);
  }

  function pickCell(nodeId, outputIdx) {
    selectingCell = { nodeId, outputIdx };
  }

  function onCellClick(node, ri, ci) {
    if (selectingCell && selectingCell.nodeId === node.id) {
      node.json.outputs[selectingCell.outputIdx].r = ri;
      node.json.outputs[selectingCell.outputIdx].c = ci;
      selectingCell = null;
      saveNode(node);
    }
  }

  onMount(fetchData);

  // Re-draw lines on scroll or resize
  let refresh = $state(0);
</script>

<main>
  <div class="menu">
    <button onclick={() => spawnNode("number")}>NUM</button>
    <button onclick={() => spawnNode("note")}>NOTE</button>
    <button onclick={() => spawnNode("equation")}>EQ</button>
    <button onclick={() => spawnNode("table")}>TAB</button>
    <div class="status">
      {#if selectingCell}
        <span class="blink">SELECT CELL</span>
      {:else if connecting}
        CONNECTING...
      {:else}
        READY
      {/if}
    </div>
  </div>

  <div class="canvas" bind:this={canvasEl} onscroll={() => refresh++}>
    <svg class="edges">
      {#key refresh}
        {#each edges as edge (edge.id)}
          {@const s = getPortPos(edge.source_id, edge.source_port, "output")}
          {@const t = getPortPos(edge.target_id, edge.target_port, "input")}
          <path
            d="M {s.x} {s.y} C {s.x + 60} {s.y}, {t.x - 60} {t.y}, {t.x} {t.y}"
            fill="none"
            stroke="#1c1c1e"
            stroke-width="2.5"
            onclick={() => deleteEdge(edge.id)}
          />
        {/each}
      {/key}
    </svg>

    {#each nodes as node (node.id)}
      <Node
        {node}
        onmove={() => refresh++}
        onsave={saveNode}
        ondelete={deleteNode}
      >
        {#if node.type === "number"}
          <div class="lcd-display">
             {node.json.value.toLocaleString()}
          </div>
          <div class="input-group center darker">
            <Port
              type="input"
              nodeId={node.id}
              name="in"
              connected={edges.some(
                (e) => e.target_id === node.id && e.target_port === "in",
              )}
              onconnect={(e) => startConnect(node.id, e.type, e.name)}
            />
            <input
              class="round-input darker"
              type="number"
              bind:value={node.json.value}
              disabled={node.json.input !== null}
              onchange={() => saveNode(node)}
            />
             <Port
              type="output"
              nodeId={node.id}
              name="out"
              onconnect={(e) => startConnect(node.id, e.type, e.name)}
            />
          </div>
        {:else if node.type === "note"}
          <textarea
            class="note-area darker"
            bind:value={node.json.text}
            onchange={() => saveNode(node)}
            placeholder="Notes..."
          ></textarea>
        {:else if node.type === "equation"}
           <div class="lcd-display result">
             {node.json.result.toFixed(2)}
          </div>
          
          <div class="inputs-row">
              <div class="tactile-port darker">
                <Port
                  type="input"
                  nodeId={node.id}
                  name="a"
                  connected={edges.some(
                    (e) => e.target_id === node.id && e.target_port === "a",
                  )}
                  onconnect={(e) => startConnect(node.id, e.type, e.name)}
                />
                <span class="label">A: {node.json.a?.toFixed(1) || 0}</span>
              </div>
              <div class="tactile-port darker">
                <Port
                  type="input"
                  nodeId={node.id}
                  name="b"
                  connected={edges.some(
                    (e) => e.target_id === node.id && e.target_port === "b",
                  )}
                  onconnect={(e) => startConnect(node.id, e.type, e.name)}
                />
                <span class="label">B: {node.json.b?.toFixed(1) || 0}</span>
              </div>
          </div>

          <input
            class="formula-round darker"
            bind:value={node.json.formula}
            placeholder="formula"
            oninput={() => saveNode(node)}
          />

          <div class="calculator-grid">
            {#each ["+", "-", "*", "/", "^", "a", "b"] as char}
              <button class="calc-btn gray"
                onclick={() => {
                  node.json.formula += char;
                  saveNode(node);
                }}>{char}</button
              >
            {/each}
            <button
              class="calc-btn orange"
              onclick={() => {
                node.json.formula = "";
                saveNode(node);
              }}>C</button
            >
          </div>
          
          <div class="footer-port-wrapper">
             <Port
              type="output"
              nodeId={node.id}
              name="out"
              onconnect={(e) => startConnect(node.id, e.type, e.name)}
            />
          </div>
        {:else if node.type === "table"}
          <div class="lcd-display mini">DATA</div>
          
          <div class="table-actions">
            <button onclick={() => addTableCol(node)} class="calc-btn gray mini"><Grid size={12} /></button>
            <button onclick={() => addTableOutput(node)} class="calc-btn gray mini"><Plus size={12} /></button>
          </div>

          <div class="tactile-grid">
            {#each node.json.cols as col}
                <div class="tactile-port vertical darker">
                  <Port
                    type="input"
                    nodeId={node.id}
                    name={col.id}
                    connected={edges.some(
                      (e) => e.target_id === node.id && e.target_port === col.id,
                    )}
                    onconnect={(e) => startConnect(node.id, e.type, e.name)}
                  />
                  <span class="val-hint">{node.json.buffer[col.id]?.toFixed(0)}</span>
                </div>
            {/each}
          </div>

          <div class="table-container darker">
            <table>
              <thead>
                <tr>
                  {#each node.json.cols as col}
                    <th>{col.name}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each node.json.rows as row, ri}
                  <tr>
                    {#each node.json.cols as col}
                      <td
                        class={selectingCell?.nodeId === node.id ? "pickable" : ""}
                        onclick={() => onCellClick(node, ri, col.id)}
                      >
                        {row[col.id]}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          
          <button class="add-row-btn darker" onclick={() => {
              node.json.rows.push({ ...node.json.buffer });
              saveNode(node);
            }}>ADD DATA POINT</button>

          <div class="table-outputs">
            {#each node.json.outputs as out, idx}
              <div class="out-item-tactile darker">
                <button
                  class="picker-btn {selectingCell?.outputIdx === idx ? 'active' : ''}"
                  onclick={() => pickCell(node.id, idx)}
                  ><Target size={12} /></button>
                <span class="label">{out.name}</span>
                <Port
                  type="output"
                  nodeId={node.id}
                  name={out.name}
                  onconnect={(e) => startConnect(node.id, e.type, e.name)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </Node>
    {/each}
  </div>
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg-dark);
    color: var(--text-main);
  }
  .menu {
    height: 60px;
    background: #000;
    display: flex;
    align-items: center;
    padding: 0 2rem;
    gap: 16px;
    z-index: 100;
    border-bottom: 1px solid #1c1c1e;
  }
  .menu button {
    background: #1c1c1e;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .status {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 700;
    color: #48484a;
    letter-spacing: 0.1em;
  }

  .canvas {
    flex: 1;
    position: relative;
    overflow: auto;
    background-color: #000;
    background-image: radial-gradient(#1c1c1e 1.5px, transparent 1.5px);
    background-size: 40px 40px;
  }
  .edges {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* LCD DISPLAY LOOK */
  .lcd-display {
    background: #000;
    color: #fff;
    font-size: 2.2rem;
    font-weight: 400;
    text-align: right;
    padding: 10px 4px;
    margin-bottom: 12px;
    font-variant-numeric: tabular-nums;
  }
  .lcd-display.result {
    color: var(--color-primary);
    font-weight: 500;
  }
  .lcd-display.mini {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #48484a;
    text-align: left;
    margin-bottom: 8px;
    padding: 4px;
  }

  .input-group.center.darker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: #050505;
    padding: 4px 8px;
    border-radius: 14px;
  }

  .round-input.darker {
    width: 100%;
    background: transparent;
    border: none;
    color: #fff;
    padding: 10px;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .note-area.darker {
    width: 100%;
    height: 100px;
    background: #050505;
    border: 1px solid #1c1c1e;
    color: #fff;
    padding: 12px;
    font-size: 0.9rem;
    resize: none;
    border-radius: 12px;
  }

  .formula-round.darker {
    width: 100%;
    background: #050505;
    border: 1px dashed #222;
    color: #fff;
    padding: 10px;
    margin: 12px 0;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: 8px;
  }

  /* CALCULATOR GRID */
  .calculator-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 12px;
  }
  .calc-btn {
    aspect-ratio: 1;
    border: none;
    border-radius: 50%;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .calc-btn.gray { background: #1c1c1e; color: #fff; }
  .calc-btn.orange { background: var(--color-primary); color: #fff; }
  .calc-btn.mini { width: 32px; height: 32px; font-size: 0.8rem; border-radius: 8px; }

  .inputs-row {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }
  .tactile-port.darker {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #050505;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid #1c1c1e;
  }
  .tactile-port .label {
    font-size: 0.65rem;
    font-weight: 700;
    color: #8e8e93;
  }

  .footer-port-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    min-height: 20px;
  }

  /* TABLE HARDWARE */
  .table-actions {
    display: flex;
    gap: 8px;
    margin: 10px 0;
  }
  .tactile-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .tactile-port.vertical.darker {
    flex-direction: column;
    padding: 8px;
    min-width: 40px;
    background: #050505;
    border: 1px solid #1c1c1e;
  }
  .val-hint { font-size: 0.65rem; font-weight: 800; color: #fff; }

  .table-container.darker {
    background: #050505;
    border: 1px solid #1c1c1e;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px; font-size: 0.6rem; color: #8e8e93; text-align: center; text-transform: uppercase; }
  td { padding: 10px; font-size: 0.85rem; text-align: center; border-top: 1px solid #1c1c1e; }
  td.pickable { background: #1c1c1e; cursor: pointer; color: var(--color-primary); }

  .add-row-btn.darker {
    width: 100%;
    background: #080808;
    border: 1px solid #1c1c1e;
    color: #fff;
    padding: 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
  }

  .out-item-tactile.darker {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    background: #050505;
    padding: 8px 14px;
    border-radius: 24px;
    border: 1px solid #1c1c1e;
  }
  .out-item-tactile .label { flex: 1; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #8e8e93; }
  .picker-btn {
    background: #1c1c1e;
    border: none;
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .picker-btn.active { background: var(--color-primary); }
</style>
