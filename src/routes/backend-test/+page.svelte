<script lang="ts">
	import { enhance } from '$app/forms'
	import type { ActionData, PageData } from './$types'

	let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<h1>backend test page</h1>

{#if form}
	<h2>last result: {form.action}</h2>
	<pre>{JSON.stringify(form, null, 2)}</pre>
{/if}

<hr />

<h2>topics ({data.topics.length})</h2>
<pre>{JSON.stringify(data.topics, null, 2)}</pre>

<h3>create topic</h3>
<form method="post" action="?/create_topic" use:enhance>
	<label>slug <input name="slug" required /></label>
	<label>name_en <input name="name_en" required /></label>
	<label>name_ja <input name="name_ja" required /></label>
	<label>
		min_level
		<select name="min_level">
			{#each data.jlpt_levels as level (level)}
				<option value={level}>{level}</option>
			{/each}
		</select>
	</label>
	<label>sort_order <input name="sort_order" type="number" value="0" required /></label>
	<label>is_active <input name="is_active" type="checkbox" checked /></label>
	<button type="submit">create topic</button>
</form>

<hr />

<h3>create question</h3>
<form method="post" action="?/create_question" use:enhance>
	<label>topic_id <input name="topic_id" type="number" required /></label>
	<label>
		level
		<select name="level">
			{#each data.jlpt_levels as level (level)}
				<option value={level}>{level}</option>
			{/each}
		</select>
	</label>
	<label>
		format
		<select name="format">
			{#each data.question_formats as format (format)}
				<option value={format}>{format}</option>
			{/each}
		</select>
	</label>
	<label>prompt <input name="prompt" required /></label>
	<label>prompt_furigana <input name="prompt_furigana" /></label>
	<label>prompt_en <input name="prompt_en" /></label>
	<label>explanation <input name="explanation" /></label>
	<label>difficulty <input name="difficulty" type="number" value="1" required /></label>
	<label>is_active <input name="is_active" type="checkbox" checked /></label>
	<button type="submit">create question</button>
</form>

<h3>create choice</h3>
<form method="post" action="?/create_choice" use:enhance>
	<label>question_id <input name="question_id" type="number" required /></label>
	<label>body <input name="body" required /></label>
	<label>is_correct <input name="is_correct" type="checkbox" /></label>
	<label>position <input name="position" type="number" value="0" required /></label>
	<button type="submit">create choice</button>
</form>

<h3>list questions by topic</h3>
<form method="post" action="?/list_questions_by_topic" use:enhance>
	<label>topic_id <input name="topic_id" type="number" required /></label>
	<button type="submit">list</button>
</form>

<h3>list choices by question</h3>
<form method="post" action="?/list_choices_by_question" use:enhance>
	<label>question_id <input name="question_id" type="number" required /></label>
	<button type="submit">list</button>
</form>

<hr />

<h2>sessions ({data.sessions_list.length})</h2>
<pre>{JSON.stringify(data.sessions_list, null, 2)}</pre>

<h3>create session</h3>
<form method="post" action="?/create_session" use:enhance>
	<label>
		level
		<select name="level">
			{#each data.jlpt_levels as level (level)}
				<option value={level}>{level}</option>
			{/each}
		</select>
	</label>
	<label>
		mode
		<select name="mode">
			{#each data.session_modes as mode (mode)}
				<option value={mode}>{mode}</option>
			{/each}
		</select>
	</label>
	<label>topic_id (optional) <input name="topic_id" type="number" /></label>
	<label>question_count <input name="question_count" type="number" value="10" required /></label>
	<button type="submit">create session</button>
</form>

<h3>submit answer</h3>
<form method="post" action="?/submit_answer" use:enhance>
	<label>session_id <input name="session_id" required /></label>
	<label>position <input name="position" type="number" value="0" required /></label>
	<label>question_id <input name="question_id" type="number" required /></label>
	<label>choice_id <input name="choice_id" type="number" /></label>
	<label>is_correct <input name="is_correct" type="checkbox" /></label>
	<label>answer_ms <input name="answer_ms" type="number" /></label>
	<label>points <input name="points" type="number" value="0" /></label>
	<button type="submit">submit answer</button>
</form>

<h3>complete session</h3>
<form method="post" action="?/complete_session" use:enhance>
	<label>session_id <input name="session_id" required /></label>
	<button type="submit">complete session</button>
</form>

<hr />

<h3>create player</h3>
<form method="post" action="?/create_player" use:enhance>
	<label>name <input name="name" required /></label>
	<button type="submit">create player</button>
</form>

<h3>link session to player</h3>
<form method="post" action="?/link_session_player" use:enhance>
	<label>session_id <input name="session_id" required /></label>
	<label>player_id <input name="player_id" type="number" required /></label>
	<button type="submit">link</button>
</form>

<hr />

<h3>ranking</h3>
<form method="post" action="?/list_ranking" use:enhance>
	<label>
		level (optional)
		<select name="level">
			<option value="">ALL</option>
			{#each data.jlpt_levels as level (level)}
				<option value={level}>{level}</option>
			{/each}
		</select>
	</label>
	<button type="submit">list ranking</button>
</form>

<style>
	:global(body) {
		max-width: 760px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
		line-height: 1.4;
	}

	h3 {
		margin-top: 2rem;
		margin-bottom: 0.5rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-start;
		padding: 0.75rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	label input,
	label select {
		flex: 1;
	}

	label:has(input[type='checkbox']) {
		width: auto;
	}

	button {
		align-self: flex-start;
		margin-top: 0.25rem;
	}

	pre {
		max-height: 300px;
		overflow: auto;
		background: #0a0d1a;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	hr {
		margin: 2rem 0;
		border: none;
		border-top: 1px solid #ddd;
	}
</style>
