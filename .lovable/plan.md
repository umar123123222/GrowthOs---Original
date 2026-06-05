Constrain `StudentNotesDialog` to viewport height and make the timeline list scroll vertically inside it.

- Add `max-h-[85vh] flex flex-col` to the `DialogContent`.
- Keep header, composer, and filter chips as non-shrinking sections.
- Wrap the timeline cards list in a `flex-1 overflow-y-auto pr-2` container so only the notes list scrolls while the composer and filters stay pinned.