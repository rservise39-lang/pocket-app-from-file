<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Materials remain project-scoped in the existing store; weekly combined totals add the project's materials to only the selected week's wages, preserving existing material records without duplication.
- Centralize calendar-week arithmetic in src/lib/weeks.ts; normalize newly chosen dates to Saturday and reuse existing weeks by start date to avoid duplicate attendance records.
