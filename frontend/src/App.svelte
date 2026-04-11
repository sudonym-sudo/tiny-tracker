<script>
    import { onMount } from "svelte";
    import { Plus, Coffee, Trash2 } from "lucide-svelte";

    let expenses = [];
    let description = "";
    let amount = "";
    let loading = true;

    const API_URL = "http://localhost:3000/api/expenses";

    async function fetchExpenses() {
        try {
            const res = await fetch(API_URL);
            expenses = await res.json();
        } catch (e) {
            console.error("Failed to fetch:", e);
        } finally {
            loading = false;
        }
    }

    async function addExpense() {
        if (!description || !amount) return;

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description,
                    amount: parseFloat(amount),
                }),
            });

            if (res.ok) {
                description = "";
                amount = "";
                await fetchExpenses();
            }
        } catch (e) {
            console.error("Failed to add:", e);
        }
    }

    onMount(fetchExpenses);
</script>

<main>
    <div class="container">
        <div class="card">
            <form on:submit|preventDefault={addExpense}>
                <input
                    type="text"
                    bind:value={description}
                    placeholder="What did you buy?"
                    required
                />
                <input
                    type="number"
                    step="0.01"
                    bind:value={amount}
                    placeholder="Amount"
                    required
                />
                <button type="submit">
                    <Plus size={18} /> Add
                </button>
            </form>
        </div>

        {#if loading}
            <p class="status">Loading...</p>
        {:else if expenses.length === 0}
            <p class="status">No expenses yet.</p>
        {:else}
            <ul class="expense-list">
                {#each expenses as expense}
                    <li>
                        <div class="info">
                            <span class="desc">{expense.description}</span>
                            <span class="date"
                                >{new Date(
                                    expense.date,
                                ).toLocaleDateString()}</span
                            >
                        </div>
                        <span class="amount">${expense.amount.toFixed(2)}</span>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</main>
