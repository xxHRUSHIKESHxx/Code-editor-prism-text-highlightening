import React, { useRef, useEffect, useState } from "react";
import Prism from "prismjs";
import 'prismjs/themes/prism-funky.css';

import "prismjs/components/prism-javascript"; // add the language you need
import "./CodeEditor.css";

const Editor = ({
  value,
  onValueChange,
  style,
  padding = 0,
  tabSize = 2,
  insertSpaces = true,
  ignoreTabKey = false,
  placeholder,
  highlight,
  ...rest
}) => {
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const [isCaretVisible, setIsCaretVisible] = useState(true);

  const history = useRef({
    stack: [],
    offset: -1,
  });

  const KEYCODE_Y = 89;
  const KEYCODE_Z = 90;
  const KEYCODE_M = 77;
  const KEYCODE_PARENS = 57;
  const KEYCODE_BRACKETS = 219;
  const KEYCODE_QUOTE = 222;
  const KEYCODE_BACK_QUOTE = 192;

  const HISTORY_LIMIT = 100;
  const HISTORY_TIME_GAP = 3000;

  const isWindows =
    typeof window !== "undefined" &&
    "navigator" in window &&
    /Win/i.test(navigator.platform);
  const isMacLike =
    typeof window !== "undefined" &&
    "navigator" in window &&
    /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);

  const capture = useRef(true);

  const recordCurrentState = () => {
    const input = textareaRef.current;

    if (!input) return;

    const { value, selectionStart, selectionEnd } = input;

    recordChange({
      value,
      selectionStart,
      selectionEnd,
    });
  };

  const getLines = (text, position) => text.substring(0, position).split("\n");

  const recordChange = (record, overwrite = false) => {
    const { stack, offset } = history.current;

    if (stack.length && offset > -1) {
      history.current.stack = stack.slice(0, offset + 1);

      const count = history.current.stack.length;

      if (count > HISTORY_LIMIT) {
        const extras = count - HISTORY_LIMIT;
        history.current.stack = stack.slice(extras, count);
        history.current.offset = Math.max(history.current.offset - extras, 0);
      }
    }

    const timestamp = Date.now();

    if (overwrite) {
      const last = history.current.stack[history.current.offset];

      if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
        const re = /[^a-z0-9]([a-z0-9]+)$/i;

        const previous = getLines(last.value, last.selectionStart)
          .pop()
          ?.match(re);
        const current = getLines(record.value, record.selectionStart)
          .pop()
          ?.match(re);

        if (previous?.[1] && current?.[1]?.startsWith(previous[1])) {
          history.current.stack[history.current.offset] = {
            ...record,
            timestamp,
          };

          return;
        }
      }
    }

    history.current.stack.push({ ...record, timestamp });
    history.current.offset++;
  };

  const updateInput = (record) => {
    const input = textareaRef.current;

    if (!input) return;

    input.value = record.value;
    input.selectionStart = record.selectionStart;
    input.selectionEnd = record.selectionEnd;

    onValueChange(record.value);
  };

  const applyEdits = (record) => {
    const input = textareaRef.current;
    const last = history.current.stack[history.current.offset];

    if (last && input) {
      history.current.stack[history.current.offset] = {
        ...last,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    }

    recordChange(record);
    updateInput(record);
  };

  const undoEdit = () => {
    const { stack, offset } = history.current;

    const record = stack[offset - 1];

    if (record) {
      updateInput(record);
      history.current.offset = Math.max(offset - 1, 0);
    }
  };

  const redoEdit = () => {
    const { stack, offset } = history.current;

    const record = stack[offset + 1];

    if (record) {
      updateInput(record);
      history.current.offset = Math.min(offset + 1, stack.length - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      textareaRef.current.blur();
    }

    const { value, selectionStart, selectionEnd } = textareaRef.current;

    const tabCharacter = (insertSpaces ? " " : "\t").repeat(tabSize);

    if (e.key === "Tab" && !ignoreTabKey && capture.current) {
      e.preventDefault();

      if (e.shiftKey) {
        const linesBeforeCaret = getLines(value, selectionStart);
        const startLine = linesBeforeCaret.length - 1;
        const endLine = getLines(value, selectionEnd).length - 1;
        const nextValue = value
          .split("\n")
          .map((line, i) => {
            if (
              i >= startLine &&
              i <= endLine &&
              line.startsWith(tabCharacter)
            ) {
              return line.substring(tabCharacter.length);
            }

            return line;
          })
          .join("\n");

        if (value !== nextValue) {
          const startLineText = linesBeforeCaret[startLine];

          applyEdits({
            value: nextValue,
            selectionStart: startLineText?.startsWith(tabCharacter)
              ? selectionStart - tabCharacter.length
              : selectionStart,
            selectionEnd: selectionEnd - (value.length - nextValue.length),
          });
        }
      } else if (selectionStart !== selectionEnd) {
        const linesBeforeCaret = getLines(value, selectionStart);
        const startLine = linesBeforeCaret.length - 1;
        const endLine = getLines(value, selectionEnd).length - 1;
        const startLineText = linesBeforeCaret[startLine];

        applyEdits({
          value: value
            .split("\n")
            .map((line, i) => {
              if (i >= startLine && i <= endLine) {
                return tabCharacter + line;
              }

              return line;
            })
            .join("\n"),
          selectionStart:
            startLineText && /\S/.test(startLineText)
              ? selectionStart + tabCharacter.length
              : selectionStart,
          selectionEnd:
            selectionEnd + tabCharacter.length * (endLine - startLine + 1),
        });
      } else {
        const updatedSelection = selectionStart + tabCharacter.length;

        applyEdits({
          value:
            value.substring(0, selectionStart) +
            tabCharacter +
            value.substring(selectionEnd),
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        });
      }
    } else if (e.key === "Backspace") {
      const hasSelection = selectionStart !== selectionEnd;
      const textBeforeCaret = value.substring(0, selectionStart);

      if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
        e.preventDefault();

        const updatedSelection = selectionStart - tabCharacter.length;

        applyEdits({
          value:
            value.substring(0, selectionStart - tabCharacter.length) +
            value.substring(selectionEnd),
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        });
      }
    } else if (e.key === "Enter") {
      if (selectionStart === selectionEnd) {
        const line = getLines(value, selectionStart).pop();
        const matches = line?.match(/^\s+/);

        if (matches?.[0]) {
          e.preventDefault();

          const indent = "\n" + matches[0];
          const updatedSelection = selectionStart + indent.length;

          applyEdits({
            value:
              value.substring(0, selectionStart) +
              indent +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        }
      }
    }

    if (
      e.key === "(" ||
      e.key === "{" ||
      e.key === "[" ||
      e.key === "'" ||
      e.key === '"' ||
      e.key === "`" ||
      e.keyCode === KEYCODE_PARENS ||
      e.keyCode === KEYCODE_BRACKETS ||
      e.keyCode === KEYCODE_QUOTE ||
      e.keyCode === KEYCODE_BACK_QUOTE
    ) {
      const hasSelection = selectionStart !== selectionEnd;
      const selectedText = value.substring(selectionStart, selectionEnd);

      if (!hasSelection) {
        if (e.key === "(") {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "()" +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        } else if (e.key === "{") {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "{}" +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        } else if (e.key === "[") {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "[]" +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        } else if (e.key === "'") {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "''" +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        } else if (e.key === '"') {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              '""' +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        } else if (e.key === "`") {
          e.preventDefault();
          const updatedSelection = selectionStart + 1;
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "``" +
              value.substring(selectionEnd),
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        }
      } else if (selectedText) {
        if (e.key === "(") {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "(" +
              selectedText +
              ")" +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        } else if (e.key === "{") {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "{" +
              selectedText +
              "}" +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        } else if (e.key === "[") {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "[" +
              selectedText +
              "]" +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        } else if (e.key === "'") {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "'" +
              selectedText +
              "'" +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        } else if (e.key === '"') {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              '"' +
              selectedText +
              '"' +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        } else if (e.key === "`") {
          e.preventDefault();
          applyEdits({
            value:
              value.substring(0, selectionStart) +
              "`" +
              selectedText +
              "`" +
              value.substring(selectionEnd),
            selectionStart: selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        }
      }
    }

    if (isUndo(e)) {
      e.preventDefault();

      if (history.current.stack.length) {
        undoEdit();
      }

      return;
    } else if (isRedo(e)) {
      e.preventDefault();

      if (history.current.stack.length) {
        redoEdit();
      }

      return;
    }
  };

  const isUndo = (event) =>
    (isMacLike && event.metaKey && event.keyCode === KEYCODE_Z) ||
    (!isMacLike && event.ctrlKey && event.keyCode === KEYCODE_Z);

  const isRedo = (event) =>
    (isMacLike &&
      event.metaKey &&
      event.shiftKey &&
      event.keyCode === KEYCODE_Z) ||
    (!isMacLike && event.ctrlKey && event.keyCode === KEYCODE_Y);

  const handleChange = (e) => {
    const input = textareaRef.current;

    if (!input) return;

    const { value, selectionStart, selectionEnd } = input;

    onValueChange(value);

    recordChange(
      {
        value,
        selectionStart,
        selectionEnd,
      },
      true
    );
  };

  const handleMouseDown = () => {
    capture.current = true;
    recordCurrentState();
  };

  const handleMouseUp = () => {
    const input = textareaRef.current;

    if (!input) return;

    const { value, selectionStart, selectionEnd } = input;

    recordChange({
      value,
      selectionStart,
      selectionEnd,
    });
  };

  const handleCopy = (e) => {
    const input = textareaRef.current;

    if (!input) return;

    const { value, selectionStart, selectionEnd } = input;

    if (selectionStart === selectionEnd) {
      return;
    }

    const selectedText = value.slice(selectionStart, selectionEnd);

    e.clipboardData.setData("text/plain", selectedText);
    e.preventDefault();
  };
  const handleCut = handleCopy;

  const handlePaste = (e) => {
    e.preventDefault();

    const input = textareaRef.current;

    if (!input) return;

    const { selectionStart, selectionEnd } = input;
    const pastedText = e.clipboardData.getData("text/plain");

    applyEdits({
      value:
        value.substring(0, selectionStart) +
        pastedText +
        value.substring(selectionEnd),
      selectionStart: selectionStart + pastedText.length,
      selectionEnd: selectionStart + pastedText.length,
    });
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.innerHTML = Prism.highlight(
        value,
        Prism.languages.javascript,
        "javascript"
      );
    }
  }, [value]);

  useEffect(() => {
    recordCurrentState();
  }, []);

  return (
    <div className="container">
      <h4>Here you can Type js Code With Real Time Syntax Highlighting</h4>
      <div
        className="npm__react-simple-code-editor__container"
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
      >
        <textarea
          ref={textareaRef}
          defaultValue={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          style={{
            ...style,
            padding,
            tabSize,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            resize: "none",
            color: "transparent",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            border: "none",
            outline: "none",
            whiteSpace: "pre",
            overflow: "auto",
            zIndex: 1,
            color: "transparent",
            caretColor: isCaretVisible ? "white" : "transparent",
          }}
          className="npm__react-simple-code-editor__textarea"
        />
        <pre
          ref={preRef}
          style={{
            ...style,
            padding,
            tabSize,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            overflow: "auto",
            margin: 0,
            color: "inherit",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            border: "none",
            outline: "none",
            whiteSpace: "pre",
            textAlign: "left",
            zIndex: 0,
          }}
        >
          {highlight(value)}
        </pre>
      </div>
    </div>
  );
};

export default Editor;
