import React, { useState } from "react";
import Editor from "./codeEditor/CodeEditor";

import "./App.css";
import Prism from "prismjs";
import "prismjs/themes/prism.css";

const App = () => {
  const [code, setCode] = useState(`function add(a, b) {
  return a + b;
}`);

  const highlight = (code) => {
    return Prism.highlight(code, Prism.languages.javascript, "javascript");
  };

  return (
    <div className="app">
      <h1>Simple React Code Editor Using Prism.js</h1>
      <Editor
        value={code}
        onValueChange={setCode}
        highlight={highlight}
        padding={10}
        style={{
          height: "500px",
        }}
        placeholder={code}
      />
    </div>
  );
};

export default App;
