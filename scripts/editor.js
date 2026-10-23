import { basicSetup } from 'https://esm.sh/codemirror';
import { EditorView, keymap } from 'https://esm.sh/@codemirror/view';
import { indentUnit, indentOnInput } from 'https://esm.sh/@codemirror/language';
import { indentWithTab } from 'https://esm.sh/@codemirror/commands';
import { python } from 'https://esm.sh/@codemirror/lang-python';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark';

export function createEditor(parent, initialValue, onChange) {
  const view = new EditorView({
    doc: initialValue,
    parent,
    extensions: [
      basicSetup,
      python(),
      indentOnInput(),
      indentUnit.of('    '),
      keymap.of([indentWithTab]),
      oneDark,
      EditorView.lineWrapping,
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange(view.state.doc.toString());
      })
    ]
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    focus: () => view.focus()
  };
}
