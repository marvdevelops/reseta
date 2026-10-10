Button is every tappable action in Reseta: a word, an optional icon, and at least 60px of target.

- **primary**: the one main action on a screen ("Take photo", "Save and set reminders", "I took it"). `tinta` fill, `on-tinta` text, `target-primary` high. Never two on one screen.
- **secondary**: the other actions in a step ("Matches the paper", "Choose a photo instead"). `surface` fill with a `line-strong` border.
- **quiet**: low-stakes actions that should not compete ("Change", "Skip this dose", "Back"). Underlined `tinta` text, still 60px tall.
- **danger**: deleting a person, a card or a reminder. Always followed by a question in words.

The consumer provides the label (a verb phrase that says what happens), `onClick`, and `block` inside steps so buttons fill the width. Don't write "OK", "Submit" or "Continue" alone; don't make icon-only buttons; don't shrink below `target-min`.
