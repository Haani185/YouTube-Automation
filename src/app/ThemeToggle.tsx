"use client";

import { useSyncExternalStore } from "react";

type Theme="dark"|"light";
const subscribe=(callback:()=>void)=>{window.addEventListener("youtube-manager-theme-change",callback);return()=>window.removeEventListener("youtube-manager-theme-change",callback)};
const clientTheme=()=>document.documentElement.dataset.theme as Theme??"dark";
const serverTheme=():Theme=>"dark";
export default function ThemeToggle(){
  const theme=useSyncExternalStore(subscribe,clientTheme,serverTheme);
  function toggle(){const next=theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("youtube-manager-theme",next);window.dispatchEvent(new Event("youtube-manager-theme-change"))}
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${theme==="dark"?"light":"dark"} theme`} title={`Switch to ${theme==="dark"?"light":"dark"} theme`}><span aria-hidden="true">{theme==="dark"?"☀":"☾"}</span><span>{theme==="dark"?"Light":"Dark"}</span></button>
}
