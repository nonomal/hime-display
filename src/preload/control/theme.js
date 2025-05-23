import { ipcRenderer } from "electron";
// document.addEventListener("DOMContentLoaded", () => {
//   ipcRenderer.invoke("control2main:query-system-theme").then((theme) => {
// updateTheme(theme);
//   });
// });
// 经测试，采用异步函数加载深色主题时，会出现又浅色到深色主题的闪烁，因此只能改用同步阻塞函数
// 放到DOMContentLoaded之前有助于减少等待时长，虽然说相对于DOMContentLoaded完成所花的几百甚至一千多ms来讲，这里省下的约0.5ms可能什么都不是
// console.time("control2main:query-system-theme");
const theme = ipcRenderer.sendSync("control2main:query-system-theme");
// 不放在DOMContentLoaded事件之后会导致document.documentElement为null
document.addEventListener("DOMContentLoaded", () => {
  // console.timeEnd("control2main:query-system-theme");
  updateTheme(theme);
});
ipcRenderer.on("main:update-theme", (evnet, theme) => {
  updateTheme(theme);
});
function updateTheme(theme) {
  if (theme === "dark") {
    document.documentElement.className = "dark";
  } else if (theme === "light") {
    document.documentElement.className = "";
  }
}
