<script>
    import { onMount } from "svelte";
    import { Plus } from "lucide-svelte";

    let nodes = [];
    let nodeLoading = true;
    const NODE_URL = "/api/nodes";

    // Form state
    let nodeType = "note";
    let nodeData = {
        text: "",
        value: "",
        formula: "",
        a: "",
        b: ""
    };

    async function fetchNodes() {
        try {
            const r = await fetch(NODE_URL);
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            nodes = await r.json();
        } catch (e) {
            console.error("Failed to fetch nodes:", e);
        } finally {
            nodeLoading = false;
        }
    }

    async function addNode() {
        let payload = {};
        if (nodeType === "note") payload = { text: nodeData.text };
        else if (nodeType === "number") payload = { value: parseFloat(nodeData.value) };
        else if (nodeType === "equation") payload = { 
            formula: nodeData.formula, 
            a: parseFloat(nodeData.a), 
            b: parseFloat(nodeData.b) 
        };

        try {
            const r = await fetch(NODE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: nodeType, json: payload }),
            });
            if (r.ok) {
                nodeData = { text: "", value: "", formula: "", a: "", b: "" };
                await fetchNodes();
            }
        } catch (e) {
            console.error("Failed to add node:", e);
        }
    }

    onMount(() => {
        fetchNodes();
    });
</script>

<main>
    <h1>Tracker</h1>

    <div style="border: 1px solid #ccc; padding: 1rem; margin-bottom: 2rem;">
        <form on:submit|preventDefault={addNode}>
            <select bind:value={nodeType}>
                <option value="note">Note</option>
                <option value="number">Number</option>
                <option value="equation">Equation</option>
            </select>

            {#if nodeType === 'note'}
                <textarea bind:value={nodeData.text} placeholder="text" required></textarea>
            {:else if nodeType === 'number'}
                <input type="number" step="any" bind:value={nodeData.value} placeholder="value" required />
            {:else if nodeType === 'equation'}
                <input type="text" bind:value={nodeData.formula} placeholder="formula" required />
                <input type="number" step="any" bind:value={nodeData.a} placeholder="a" required />
                <input type="number" step="any" bind:value={nodeData.b} placeholder="b" required />
            {/if}
            
            <button type="submit"><Plus size={18} /> Create Node</button>
        </form>
    </div>

    {#if nodeLoading}
        <p>Loading nodes...</p>
    {:else if nodes.length === 0}
        <p>No nodes yet.</p>
    {:else}
        <div>
            {#each nodes as node}
                <pre style="background: #f4f4f4; padding: 0.5rem; border: 1px solid #ddd; margin-bottom: 0.5rem;">{JSON.stringify(node, null, 2)}</pre>
            {/each}
        </div>
    {/if}
</main>
