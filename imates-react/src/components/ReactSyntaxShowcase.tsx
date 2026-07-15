import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  useContext,
  createContext,
  forwardRef,
  useImperativeHandle,
} from 'react';

// ==========================================
// 1. Context (跨组件状态共享)
// ==========================================
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ==========================================
// 2. TypeScript 类型声明 (Props, State, Reducer)
// ==========================================
interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
}

interface ReactSyntaxShowcaseProps {
  title?: string;
  initialCount?: number;
  onActionComplete?: (message: string) => void;
  children?: React.ReactNode; // 插槽 (Children)
}

// useReducer 的 Action 与 State 类型
type CounterAction =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset'; payload: number };

interface CounterState {
  count: number;
}

const counterReducer = (state: CounterState, action: CounterAction): CounterState => {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: action.payload };
    default:
      return state;
  }
};

// ==========================================
// 3. Custom Hook (自定义 Hook 提取公共逻辑)
// ==========================================
function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    // 返回清理函数 (生命周期: 卸载/销毁)
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // 仅在 Mount 时执行

  return width;
}

// ==========================================
// 4. ForwardRef & ImperativeHandle (引用转发 & 暴露方法)
// ==========================================
interface CustomInputHandle {
  focusInput: () => void;
  clearInput: () => void;
}

const CustomInput = forwardRef<CustomInputHandle, { label: string }>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    },
    clearInput: () => {
      setValue('');
    }
  }));

  return (
    <div style={{ margin: '10px 0' }}>
      <label>{props.label}: </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="点击父组件按钮来聚焦或清空我"
        style={{ padding: '6px', marginLeft: '8px' }}
      />
    </div>
  );
});
CustomInput.displayName = 'CustomInput';


// ==========================================
// 5. 主组件 (Main Component)
// ==========================================
export const ReactSyntaxShowcase: React.FC<ReactSyntaxShowcaseProps> = ({
  title = 'React 语法全解析',
  initialCount = 0,
  onActionComplete,
  children,
}) => {
  // 5.1 useState (常规状态声明)
  const [inputValue, setInputValue] = useState<string>('');
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: '张三', role: 'admin' },
    { id: 2, name: '李四', role: 'user' },
    { id: 3, name: '王五', role: 'user' },
  ]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 5.2 useReducer (复杂状态管理)
  const [state, dispatch] = useReducer(counterReducer, { count: initialCount });

  // 5.3 Custom Hook 的使用
  const windowWidth = useWindowWidth();

  // 5.4 useRef (DOM 节点与持久化非响应变量)
  const inputElRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<CustomInputHandle>(null);
  const renderCounter = useRef<number>(0);

  // 每次渲染自增计算渲染次数 (不触发重绘)
  useEffect(() => {
    renderCounter.current += 1;
  });

  // 5.5 useMemo (计算属性 / 记忆计算结果)
  const filteredUsers = useMemo(() => {
    console.log('--- useMemo 触发计算 ---');
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]); // 仅当 users 或 searchTerm 改变时重算

  // 5.6 useCallback (记忆化函数，避免子组件不必要重绘)
  const handleUserAdd = useCallback((newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    onActionComplete?.(`新增用户: ${newUser.name}`);
  }, [onActionComplete]);

  // 5.7 useEffect (监听变化与副作用)
  useEffect(() => {
    console.log(`[Effect] 计数器发生改变，当前值: ${state.count}`);
  }, [state.count]); // 监听 state.count

  // 5.8 辅助事件处理
  const triggerAddAdmin = () => {
    const newId = users.length + 1;
    handleUserAdd({ id: newId, name: `新管理员-${newId}`, role: 'admin' });
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>{title}</h2>
      <p style={{ color: 'gray' }}>当前组件渲染次数: {renderCounter.current}</p>
      <p style={{ color: 'blue' }}>浏览器窗口宽度 (Custom Hook): {windowWidth}px</p>

      <hr />

      {/* 计数器模块 (useReducer) */}
      <section style={{ margin: '15px 0' }}>
        <h3>1. 计数器状态 (useReducer)</h3>
        <p>Count: <strong>{state.count}</strong></p>
        <button onClick={() => dispatch({ type: 'increment' })} style={btnStyle}>+1</button>
        <button onClick={() => dispatch({ type: 'decrement' })} style={btnStyle}>-1</button>
        <button onClick={() => dispatch({ type: 'reset', payload: initialCount })} style={btnStyle}>重置</button>
      </section>

      <hr />

      {/* 表单输入与 Ref 聚焦 (Controlled vs Uncontrolled / ForwardRef) */}
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

        <div style={{ margin: '10px 0' }}>
          <label>非受控输入框 (useRef): </label>
          <input ref={inputElRef} type="text" placeholder="我会用Ref聚焦" style={{ padding: '6px' }} />
          <button onClick={() => inputElRef.current?.focus()} style={btnStyle}>点击聚焦此输入框</button>
        </div>

        {/* 引用转发组件的调用 */}
        <CustomInput ref={childInputRef} label="转发 Ref 输入框" />
        <button onClick={() => childInputRef.current?.focusInput()} style={btnStyle}>聚焦转发输入框</button>
        <button onClick={() => childInputRef.current?.clearInput()} style={btnStyle}>清空转发输入框</button>
      </section>

      <hr />

      {/* 列表渲染与条件过滤 (List & Conditional Rendering) */}
      <section style={{ margin: '15px 0' }}>
        <h3>3. 列表循环与过滤 (v-for 对标 / useMemo)</h3>
        <input
          type="text"
          placeholder="搜索用户名..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '6px', marginBottom: '10px', width: '90%' }}
        />
        
        <ul style={{ paddingLeft: '20px' }}>
          {/* list.map 渲染 (v-for) */}
          {filteredUsers.map((user) => (
            <li key={user.id} style={{ margin: '6px 0' }}>
              {user.name} - 
              {/* 条件渲染: 三元表达式 */}
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

      <hr />

      {/* 插槽/子内容传递 (Children) */}
      <section style={{ margin: '15px 0' }}>
        <h3>4. 插槽内容 (Children / Slots)</h3>
        <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
          {children || <p style={{ color: 'gray' }}>暂无外部插槽内容，此为默认内容</p>}
        </div>
      </section>
    </div>
  );
};

// 按钮统一样式
const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  marginRight: '8px',
  cursor: 'pointer',
  backgroundColor: '#f0f0f0',
  border: '1px solid #999',
  borderRadius: '4px',
};


// ==========================================
// 6. 整合 Context Provider 的包裹组件
// ==========================================
export default function ReactSyntaxShowcaseWithProvider() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div style={{
        backgroundColor: theme === 'light' ? '#fff' : '#222',
        color: theme === 'light' ? '#000' : '#fff',
        transition: 'all 0.3s ease',
        padding: '30px 10px',
        minHeight: '100vh',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span>当前主题模式: <strong>{theme.toUpperCase()}</strong></span>
          <button onClick={toggleTheme} style={{ ...btnStyle, marginLeft: '12px' }}>切换主题 (Context)</button>
        </div>

        {/* 调用主组件并传递 Props & 插槽 (Children) */}
        <ReactSyntaxShowcase
          title="React 全套语法速查指南组件"
          initialCount={10}
          onActionComplete={(msg) => console.log('Action Callback:', msg)}
        >
          {/* 这里是传入的插槽子内容 */}
          <div>
            <h4 style={{ margin: '0 0 8px 0' }}>这是作为 Children 传入的插槽内容：</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>插槽内部可以任意放置其他组件或 HTML 元素。</p>
          </div>
        </ReactSyntaxShowcase>
      </div>
    </ThemeContext.Provider>
  );
}
