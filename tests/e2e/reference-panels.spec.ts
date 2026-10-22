import { expect, test } from "playwright/test";

test("素材搜索、分组与版本预览在手机上可用", async ({ page }, info) => {
  const now = "2026-10-14T00:00:00Z";
  await page.route(url => url.pathname === "/api/projects/panels-demo", route => route.fulfill({ json: { data: {
    id: "panels-demo", name: "素材侧栏项目", status: "active", createdAt: now, updatedAt: now, selections: {},
    assets: ["source", "white_background"].map((kind, i) => ({ id: `asset-${i}`, kind, state: "available", filename: i ? "白底图.png" : "商品原图.jpg", mimeType: "image/jpeg", byteSize: 1024, width: 1200, height: 800, createdAt: now })),
  } } }));
  await page.route(url => url.pathname.endsWith("/preview"), route => route.fulfill({ path: "public/assets/gan65-product.jpg", contentType: "image/jpeg" }));
  await page.route(url => url.pathname.endsWith("/white-background-generations"), route => route.fulfill({ json: { data: [] } }));
  await page.goto("/projects/panels-demo?tab=base");
  await page.getByRole("button", { name: "素材与历史", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "素材与历史" });
  await expect(panel).toBeVisible();
  const search = panel.getByRole("textbox", { name: "搜索项目素材" });
  await search.fill("  白底  ");
  await expect(panel.locator(".asset-item")).toHaveCount(1);
  await search.fill("不存在");
  await expect(panel.getByText("没有找到匹配的素材")).toBeVisible();
  await search.fill("");
  const sourceGroup = panel.locator(".asset-group-toggle").filter({ hasText: "原图" });
  await sourceGroup.click(); await expect(sourceGroup).toHaveAttribute("aria-expanded", "false");
  await sourceGroup.click();
  await panel.locator(".asset-item").first().click();
  await expect(panel.getByRole("heading", { name: "商品原图.jpg" })).toBeVisible();
  const preview = panel.getByRole("button", { name: "预览版本 1", exact: true });
  await preview.click();
  const dialog = page.getByRole("dialog", { name: "商品原图.jpg · v1" });
  await expect(dialog.getByRole("img")).toHaveCSS("object-fit", "contain");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(preview).toBeFocused();
  await page.screenshot({ path: info.outputPath("history-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole("button", { name: "关闭素材面板" })).toBeVisible();
  expect(await panel.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("history-mobile.png") });
  await panel.getByRole("button", { name: "关闭素材面板" }).click();
  await expect(panel).toHaveCount(0);
});

test("版本对比最多选择两张，切换素材清空选择", async ({ page }) => {
  const componentSource = await (await page.request.get("/src/components/HistoryVersionPanel.tsx")).text();
  const mainSource = await (await page.request.get("/src/main.tsx")).text();
  const reactUrl = componentSource.match(/from "([^" ]*deps\/react\.js[^" ]*)"/)![1];
  const domUrl = mainSource.match(/from "([^" ]*deps\/react-dom_client\.js[^" ]*)"/)![1];
  await page.route("**/__panel-fixture", route => route.fulfill({ contentType: "text/html", body: `
    <html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script><script type="module">
    import React from '${reactUrl}';
    import ReactDOM from '${domUrl}';
    import { HistoryVersionPanel } from '/src/components/HistoryVersionPanel.tsx';
    import '/src/index.css'; import '/src/pages/reference-workspaces.css'; import '/src/components/reference-panels.css';
    const versions = [1,2,3].map(n => ({id:'v'+n,version:n,url:'/assets/gan65-product.jpg',createdAt:'2026-10-14',template:'场景图',status:'ready'}));
    function App() { const [id, setId] = React.useState('first'); return React.createElement('div', {className:'app-shell reference-project-workbench'},
      React.createElement('button', {onClick:()=>setId('second')}, '切换素材'),
      React.createElement(HistoryVersionPanel, {asset:{id,name:id,versions}})); }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    </script></body></html>` }));
  await page.goto("/__panel-fixture");
  await page.getByRole("button", { name: "对比版本 1", exact: true }).click();
  await page.getByRole("button", { name: "对比版本 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "版本对比" }).getByRole("img")).toHaveCount(2);
  await page.getByRole("button", { name: "对比版本 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "对比版本 1", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "对比版本 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "切换素材" }).click();
  await expect(page.getByRole("region", { name: "版本对比" })).toHaveCount(0);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
});
