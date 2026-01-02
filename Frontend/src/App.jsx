import { useState } from "react";
import "./App.css";

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (input.trim() === "") return;

    setTodos([
      ...todos,
      { id: Date.now(), text: input, completed: false }
    ],);
    setInput("");
  };

  const toggleTodo = (id) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id
          ? { ...todo, completed: !todo.completed }
          : todo
      )
    );
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <div className="app">
      <div className="todo-card">
        <h2 className="title">To-Do App</h2>

        <div className="stats">
          <span>{todos.length} Total</span>
          <span>{completedCount} Completed</span>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Add a new task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button onClick={addTodo}>Add Task</button>
        </div>

        <ul className="todo-list">
          {todos.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Add one to get started!</p>
            </div>
          ) : (
            todos.map((todo) => (
              <li key={todo.id} className="todo-item">
                <div className="left">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                  />
                  <span className={todo.completed ? "completed" : ""}>
                    {todo.text}
                  </span>
                </div>

                <button
                  className="delete-btn"
                  onClick={() => deleteTodo(todo.id)}
                  title="Delete task"
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export default App;
