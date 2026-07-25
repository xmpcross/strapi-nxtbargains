# Editorial pattern for snippets & AI answers

Goal: let Google (featured snippets, voice, AI Overviews) and AI engines extract a
direct answer from every comparison, review and guide.

## 1. Lead with a TL;DR (Strapi `keyTakeaways` field)
Fill the post's **Key takeaways** field with either 2–5 bullets or a single
40–60 word summary that answers the reader's core question up front. It renders
as a callout at the very top of the article (`<KeyTakeaways>`).

Field accepts markdown-lite (`- bullets`, `**bold**`, `[text](url)`) or HTML.

## 2. Question heading + 40–60 word direct answer
Structure every major section as a **natural-language question** heading, then
answer it **immediately** in 40–60 self-contained words, then add deeper detail:

```
## How does the Ring Doorbell compare to Nest?
Nest wins on video quality and smart alerts, while Ring offers more models and
cheaper subscriptions. For homes already on Google, Nest integrates better; Ring
is the safer pick for Alexa households and tighter budgets.
<…deeper comparison, specs, table…>
```

Rules: lead with the conclusion, keep the answer standalone (no "as shown below"),
40–60 words. This is the unit search/AI engines quote.

## 3. Comparisons need a semantic table
Include a real `<table>` with a `<caption>`, `<th scope="col">` column headers and
`<th scope="row">` for the first cell of each row. PostContent auto-fills missing
`scope` attributes and wraps wide tables for horizontal scroll, but the `<caption>`
and `<th>` structure must come from the content.

See `components/KeyTakeaways.tsx` JSDoc for the same guidance inline.
