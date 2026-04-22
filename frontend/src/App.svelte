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
            fetch(`${API_URL}/edges`)
        ]);
        nodes = await nRes.json();
        edges = await eRes.json();
    }

    async function saveNode(node) {
        await fetch(`${API_URL}/nodes/${node.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: node.json })
        });
    }

    async function spawnNode(type) {
        let json = { x: 100, y: 100 };
        if (type === "number") json = { ...json, value: 0, input: null };
        if (type === "note") json = { ...json, text: "" };
        if (type === "equation") json = { ...json, formula: "", a: 0, b: 0, result: 0, tokens: [], error: null };
        if (type === "table") {
            json = { 
                ...json, 
                cols: [{ id: 'c1', name: 'Val' }], 
                rows: [], 
                buffer: { 'c1': 0 }, 
                outputs: [{ name: 'out', r: 0, c: 'c1' }] 
            };
        }

        const r = await fetch(`${API_URL}/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, json })
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
                target_port: t.name
            })
        });
        fetchData();
    }

    async function deleteEdge(id) {
        await fetch(`${API_URL}/edges/${id}`, { method: "DELETE" });
        fetchData();
    }

    // -------------------- ENGINE & LOGIC -------------------- //

    $effect(() => {
        nodes.forEach(node => {
            const inputs = edges.filter(e => e.target_id === node.id);
            
            if (node.type === "number") {
                const conn = inputs.find(e => e.target_port === "in");
                if (conn) {
                    node.json.input = getOutput(nodes.find(n => n.id === conn.source_id), conn.source_port);
                    node.json.value = node.json.input;
                } else node.json.input = null;
            }

            if (node.type === "equation") {
                const connA = inputs.find(e => e.target_port === "a");
                const connB = inputs.find(e => e.target_port === "b");
                if (connA) node.json.a = getOutput(nodes.find(n => n.id === connA.source_id), connA.source_port);
                if (connB) node.json.b = getOutput(nodes.find(n => n.id === connB.source_id), connB.source_port);
                try {
                    node.json.result = evaluateEquation(node.json.formula, node.json.a, node.json.b);
                    node.json.error = null;
                    node.json.tokens = tokenize(node.json.formula);
                } catch (e) { node.json.error = e.message; }
            }

            if (node.type === "table") {
                node.json.cols.forEach(col => {
                    const conn = inputs.find(e => e.target_port === col.id);
                    if (conn) {
                        node.json.buffer[col.id] = getOutput(nodes.find(n => n.id === conn.source_id), conn.source_port);
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
            const outDef = node.json.outputs.find(o => o.name === portName);
            if (!outDef) return 0;
            const row = node.json.rows[outDef.r];
            return row ? (row[outDef.c] || 0) : 0;
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
                while (i < formula.length && /[\d.]/.test(formula[i])) num += formula[i++];
                tokens.push({ type: "number", value: num });
                continue;
            }
            if (/[ab]/.test(char)) tokens.push({ type: "variable", value: char });
            else if (/[\+\-\*\/\%\^]/.test(char)) {
                if (char === "^" && formula[i+1] && !/[\dab]/.test(formula[i+1])) throw new Error("'^' must be followed by number or variable");
                tokens.push({ type: "operator", value: char });
            }
            i++;
        }
        return tokens;
    }

    function evaluateEquation(formula, a, b) {
        if (!formula) return 0;
        let f = formula.replace(/(\d)([ab])/g, '$1*$2').replace(/([ab])([ab])/g, '$1*$2');
        const safeFormula = f.replace(/a/g, `(${a})`).replace(/b/g, `(${b})`).replace(/\^/g, "**");
        try { return eval(safeFormula) || 0; } catch { return 0; }
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
            y: rect.top - canvasRect.top + rect.height / 2 + canvasEl.scrollTop
        };
    }

    // -------------------- TABLE ACTIONS -------------------- //

    function addTableCol(node) {
        const id = 'c' + (node.json.cols.length + 1);
        node.json.cols.push({ id, name: 'New' });
        node.json.buffer[id] = 0;
        node.json.rows.forEach(r => r[id] = 0);
        saveNode(node);
    }

    function addTableOutput(node) {
        const name = 'out' + (node.json.outputs.length + 1);
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
        <button onclick={() => spawnNode('number')}>+ Number</button>
        <button onclick={() => spawnNode('note')}>+ Note</button>
        <button onclick={() => spawnNode('equation')}>+ Equation</button>
        <button onclick={() => spawnNode('table')}>+ Table</button>
        <div class="status">
            {#if selectingCell} <span class="blink">Select a cell for Output...</span> 
            {:else if connecting} Connecting {connecting.name}...
            {:else} Ready {/if}
        </div>
    </div>

    <div class="canvas" bind:this={canvasEl} onscroll={() => refresh++}>
        <svg class="edges">
            {#key refresh}
                {#each edges as edge (edge.id)}
                    {@const s = getPortPos(edge.source_id, edge.source_port, 'output')}
                    {@const t = getPortPos(edge.target_id, edge.target_port, 'input')}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <path 
                        d="M {s.x} {s.y} C {s.x + 80} {s.y}, {t.x - 80} {t.y}, {t.x} {t.y}"
                        fill="none" 
                        stroke="#28a745" 
                        stroke-width="3"
                        onclick={() => deleteEdge(edge.id)}
                    />
                {/each}
            {/key}
        </svg>

        {#each nodes as node (node.id)}
            <Node {node} onmove={() => refresh++} onsave={saveNode} ondelete={deleteNode}>
                {#if node.type === 'number'}
                    <div class="input-group">
                        <Port type="input" nodeId={node.id} name="in" connected={edges.some(e => e.target_id === node.id && e.target_port === 'in')} onconnect={(e) => startConnect(node.id, e.type, e.name)} />
                        <input type="number" bind:value={node.json.value} disabled={node.json.input !== null} onchange={() => saveNode(node)} />
                    </div>
                    <Port type="output" nodeId={node.id} name="out" onconnect={(e) => startConnect(node.id, e.type, e.name)} />

                {:else if node.type === 'note'}
                    <textarea bind:value={node.json.text} onchange={() => saveNode(node)} placeholder="Note..."></textarea>

                {:else if node.type === 'equation'}
                    <div class="inputs-column">
                        <div class="port-with-val horizontal">
                            <Port type="input" nodeId={node.id} name="a" connected={edges.some(e => e.target_id === node.id && e.target_port === 'a')} onconnect={(e) => startConnect(node.id, e.type, e.name)} />
                            <span class="val-hint">{node.json.a?.toFixed(1) || 0}</span>
                        </div>
                        <div class="port-with-val horizontal">
                            <Port type="input" nodeId={node.id} name="b" connected={edges.some(e => e.target_id === node.id && e.target_port === 'b')} onconnect={(e) => startConnect(node.id, e.type, e.name)} />
                            <span class="val-hint">{node.json.b?.toFixed(1) || 0}</span>
                        </div>
                    </div>
                    <input class="formula-input" bind:value={node.json.formula} placeholder="e.g. 2a + b^2" oninput={() => saveNode(node)} />
                    <div class="equation-buttons">
                        {#each ['+', '-', '*', '/', '^', '%', 'a', 'b'] as char} <button onclick={() => { node.json.formula += char; saveNode(node); }}>{char}</button> {/each}
                        <button class="clear" onclick={() => { node.json.formula = ''; saveNode(node); }}>C</button>
                    </div>
                    <div class="tokens"> {#each node.json.tokens || [] as token} <span class="token {token.type}">{token.value}</span> {/each} </div>
                    {#if node.json.error} <div class="error">{node.json.error}</div> {/if}
                    <div class="result">= {node.json.result.toFixed(2)}</div>
                    <Port type="output" nodeId={node.id} name="out" onconnect={(e) => startConnect(node.id, e.type, e.name)} />

                {:else if node.type === 'table'}
                    <div class="table-controls">
                        <button onclick={() => addTableCol(node)} title="Add Column"><Grid size={12} /></button>
                        <button onclick={() => addTableOutput(node)} title="Add Output"><Plus size={12} /></button>
                    </div>

                    <div class="inputs-column">
                        {#each node.json.cols as col}
                            <div class="port-with-val horizontal">
                                <Port type="input" nodeId={node.id} name={col.id} connected={edges.some(e => e.target_id === node.id && e.target_port === col.id)} onconnect={(e) => startConnect(node.id, e.type, e.name)} />
                                <span class="val-hint" title={col.name}>{node.json.buffer[col.id]?.toFixed(1) || 0}</span>
                            </div>
                        {/each}
                    </div>

                    <div class="grid">
                        <table>
                            <thead>
                                <tr>
                                    {#each node.json.cols as col}
                                        <th><input class="col-name" bind:value={col.name} onchange={() => saveNode(node)} /></th>
                                    {/each}
                                </tr>
                            </thead>
                            <tbody>
                                {#each node.json.rows as row, ri}
                                    <tr>
                                        {#each node.json.cols as col}
                                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                            <td 
                                                class={selectingCell?.nodeId === node.id ? 'pickable' : ''}
                                                onclick={() => onCellClick(node, ri, col.id)}
                                            >
                                                {row[col.id]}
                                            </td>
                                        {/each}
                                    </tr>
                                {/each}
                                <tr class="buffer">
                                    {#each node.json.cols as col}
                                        <td><input type="number" bind:value={node.json.buffer[col.id]} onchange={() => saveNode(node)} /></td>
                                    {/each}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button class="add-row" onclick={() => { node.json.rows.push({...node.json.buffer}); saveNode(node); }}>Add Row</button>
                    
                    <div class="table-outputs">
                        {#each node.json.outputs as out, idx}
                            <div class="out-item">
                                <button class="picker {selectingCell?.outputIdx === idx ? 'active' : ''}" onclick={() => pickCell(node.id, idx)}><Target size={12} /></button>
                                <input class="out-name" bind:value={out.name} onchange={() => saveNode(node)} />
                                <Port type="output" nodeId={node.id} name={out.name} onconnect={(e) => startConnect(node.id, e.type, e.name)} />
                            </div>
                        {/each}
                    </div>
                {/if}
            </Node>
        {/each}
    </div>
</main>

<style>
    main { width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: #000; font-family: sans-serif; color: #eee; }
    .menu { height: 50px; background: #0a0a0a; display: flex; align-items: center; padding: 0 1rem; gap: 8px; color: white; z-index: 100; border-bottom: 1px solid #222; }
    .menu button { background: #111; color: #007bff; border: 1px solid #333; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: bold; }
    .menu button:hover { background: #222; border-color: #007bff; color: #fff; box-shadow: 0 0 10px rgba(0, 123, 255, 0.3); }
    .status { margin-left: auto; font-size: 0.8rem; font-weight: bold; color: #444; }
    .blink { color: #ffeb3b; animation: blink 1s infinite; text-shadow: 0 0 5px rgba(255, 235, 59, 0.5); }
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

    .canvas { flex: 1; position: relative; overflow: auto; background-color: #000; background-image: radial-gradient(#222 1.5px, transparent 1.5px); background-size: 30px 30px; }
    .edges { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .edges path { pointer-events: stroke; cursor: pointer; transition: stroke 0.2s; filter: drop-shadow(0 0 3px rgba(40, 167, 69, 0.4)); }
    .edges path:hover { stroke: #ff4444; stroke-width: 5; filter: drop-shadow(0 0 5px rgba(255, 68, 68, 0.6)); }

    input, textarea { 
        width: 100%; box-sizing: border-box; border: 1px solid #222; border-radius: 4px; 
        padding: 6px; font-size: 0.9rem; background: #050505; color: #fff; margin: 4px 0;
    }
    input:focus { border-color: #007bff; outline: none; }
    .input-group { display: flex; flex-direction: column; }
    
    .inputs-column { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
    .port-with-val { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .port-with-val.horizontal { flex-direction: row; align-items: center; gap: 8px; }
    .val-hint { font-size: 0.65rem; color: #28a745; font-family: monospace; font-weight: bold; }
    
    .formula-input { font-family: 'Iosevka', monospace; color: #a5d6a7; border-color: #333; }
    .equation-buttons { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
    .equation-buttons button { padding: 4px 10px; font-size: 0.8rem; background: #111; border: 1px solid #333; border-radius: 4px; cursor: pointer; color: #aaa; }
    .equation-buttons button:hover { background: #222; color: #fff; border-color: #555; }
    .equation-buttons .clear { border-color: #411; color: #f44; }

    .result { text-align: right; font-weight: bold; font-size: 1.3rem; color: #28a745; margin: 8px 0; text-shadow: 0 0 10px rgba(40, 167, 69, 0.3); }
    .error { color: #f44; font-size: 0.75rem; background: #211; padding: 4px; border-radius: 4px; margin-top: 4px; border: 1px solid #411; }

    /* TABLE SPECIFIC */
    .table-controls { display: flex; gap: 4px; margin-bottom: 8px; justify-content: flex-end; }
    .table-controls button { background: #111; border: 1px solid #333; color: #aaa; border-radius: 4px; cursor: pointer; padding: 2px 6px; }
    .table-controls button:hover { color: #fff; border-color: #555; }
    .table-ports.inputs { display: flex; gap: 12px; justify-content: center; margin-bottom: 4px; }
    .grid { border: 1px solid #222; border-radius: 4px; overflow: hidden; margin: 8px 0; background: #000; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th { background: #0a0a0a; border-bottom: 1px solid #222; padding: 0; }
    .col-name { border: none; background: transparent; text-align: center; font-weight: bold; font-size: 0.7rem; padding: 4px; color: #888; }
    td { border: 1px solid #222; padding: 6px; text-align: center; min-width: 40px; color: #ccc; }
    td.pickable { cursor: crosshair; background: #110; color: #ffeb3b; }
    td.pickable:hover { background: #220; }
    .buffer input { border: none; background: #080808; text-align: center; color: #555; }
    .add-row { width: 100%; padding: 6px; background: #111; border: 1px solid #222; cursor: pointer; font-size: 0.8rem; font-weight: bold; color: #888; }
    .add-row:hover { background: #151515; color: #fff; }

    .table-outputs { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
    .out-item { display: flex; align-items: center; gap: 6px; }
    .out-name { font-size: 0.7rem; padding: 2px 4px; color: #007bff; border-color: #111; }
    .picker { background: #111; border: 1px solid #333; color: #aaa; border-radius: 4px; cursor: pointer; padding: 2px; }
    .picker.active { background: #330; border-color: #ffeb3b; color: #ffeb3b; box-shadow: 0 0 10px rgba(255, 235, 59, 0.2); }
</style>
