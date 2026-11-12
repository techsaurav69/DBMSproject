import { useEffect, useState, type ReactElement } from 'react';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function TimeGreeting({ name }: { name: string }): ReactElement {
  const [text, setText] = useState(greeting);
  useEffect(() => {
    const update = () => setText(greeting());
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <>{text}, {name}.</>;
}
