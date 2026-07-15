import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useReducer,
  useRef,
  useContext,
  createContext,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface User {
  id: number;
  name: string;
  role: "admin" | "user";
}

interface ReactSyntaxShowcaseProps {
  title?: string;
  initialCount?: number;
  onActionComplete?: (message: string) => void;
  children?: React.ReactNode; // 插槽 (Children)
}

type CounterAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset"; payload: number };

interface CounterState {
  count: number;
}

const counterReducer = (state: CounterState, action: CounterAction): CounterState => {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return { count: action.payload };
    default:
      return state;
  }
};

function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  return width;
}

interface CustomInputHandle {
  focusInput: () => void;
  clearInput: () => void;
}

const CustomInput = forwardRef<CustomInputHandle, { label: string }>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    },
    clearInput: () => {
      setValue("");
    },
  }));

  return (
    <div style={{ margin: "10px 0" }}>
      <label>{props.label}: </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="点击父组件按钮来聚焦或清空我"
        style={{ padding: "6px", marginLeft: "8px" }}
      />
    </div>
  );
});
CustomInput.displayName = "CustomInput";

export const ReactSyntaxShowcase: React.FC<ReactSyntaxShowcaseProps> = ({
  title = "React 语法全解析",
  initialCount = 0,
  onActionComplete,
  children,
}) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: "张三", role: "admin" },
    { id: 2, name: "李四", role: "user" },
    { id: 3, name: "王五", role: "user" },
  ]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [state, dispatch] = useReducer(counterReducer, { count: initialCount });
  const windowWidth = useWindowWidth();
  const inputElRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<CustomInputHandle>(null);
  const renderCounter = useRef<number>(0);
  useEffect(() => {
    renderCounter.current += 1;
  });

  const filteredUsers = useMemo(() => {
    console.log('--- useMemo 触发计算 ---');
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleUserAdd = useCallback((newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    onActionComplete?.(`新增用户: ${newUser.name}`);
  }, [onActionComplete]);

  const triggerAddAdmin = () => {
    const newId = users.length + 1;
    handleUserAdd({ id: newId, name: `新管理员-${newId}`, role: 'admin' });
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    margin: '0 4px',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h2>{title}</h2>
      <p style={{ color: "gray" }}>当前组件渲染次数: {renderCounter.current}</p>
      <p style={{ color: "blue" }}>浏览器窗口宽度 (Custom Hook): {windowWidth}px</p>
      <hr />
      <section style={{ margin: "15px 0" }}>
        <h3>1. 计数器状态 (useReducer)</h3>
        <p>
          Count: <strong>{state.count}</strong>
        </p>
        <button onClick={() => dispatch({ type: "increment" })} style={btnStyle}>
          +1
        </button>
        <button onClick={() => dispatch({ type: "decrement" })} style={btnStyle}>
          -1
        </button>
        <button onClick={() => dispatch({ type: "reset", payload: initialCount })} style={btnStyle}>
          重置
        </button>
      </section>
      <hr />
      <section style={{ margin: '15px 0' }}>
        <h3>2. 表单与 Ref 引用 (useRef & forwardRef)</h3>
        <div style={{ margin: '10px 0' }}>
          <label>受控输入框: </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ padding: '6px' }}
          />
          <span style={{ marginLeft: '10px' }}>实时值: {inputValue}</span>
        </div>
        <div style={{margin:'10px 0'}}>
            <label>非受控输入框 (useRef): </label>
            <input type="text" ref={inputElRef} placeholder="我会用Ref聚焦" style={{ padding: '6px' }} />
            <button onClick={() => inputElRef.current?.focus()} style={btnStyle}>点击聚焦此输入框</button>
        </div>
        <CustomInput ref={childInputRef} label="转发 Ref 输入框" />
        <button onClick={() => childInputRef.current?.focusInput()} style={btnStyle}>聚焦转发输入框</button>
        <button onClick={() => childInputRef.current?.clearInput()} style={btnStyle}>清空转发输入框</button>
      </section>
      <hr />

      {/* 列表渲染与条件过滤 (List & Conditional Rendering) */}
      <section style={{ margin: '15px 0' }}>
        <h3>3. 列表循环与过滤 (v-for 对标 / useMemo)</h3>
        <input type="text" 
        placeholder="搜索用户名..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: '6px', marginBottom: '10px', width: '90%' }}
        />
        <ul style={{ paddingLeft: '20px' }}>
          {filteredUsers.map((user) => (
            <li key={user.id} style={{ margin: '6px 0' }}>
              {user.name} - 
              {user.role === 'admin' ? (
                <span style={{ color: 'red', fontWeight: 'bold', marginLeft: '5px' }}>[管理员]</span>
              ) : (
                <span style={{ color: 'green', marginLeft: '5px' }}>[普通用户]</span>
              )}
            </li>
          ))}
        </ul>
        {/* 条件渲染: inline && 表达式 */}
        {filteredUsers.length === 0 && (
          <p style={{ color: 'orange' }}>未搜寻到匹配的用户！</p>
        )}

        <button onClick={triggerAddAdmin} style={btnStyle}>新增管理员 (useCallback)</button>

      </section>
      
    </div>
  );
};
