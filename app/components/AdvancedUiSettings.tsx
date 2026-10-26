"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearStoredUiCustomization,
  defaultUiCustomization,
  clearUiCustomizationDraft,
  getPreviewUiCustomization,
  previewDraftUiCustomization,
  previewUiCustomization,
  type UiCustomization,
} from "../lib/ui-customization";
import { getSavedUiCustomization } from "../lib/site-ui-customization";
import { clearInterfaceVersionPreview, clearStoredInterfaceVersion, getServerInterfaceVersion, getStoredInterfaceVersion, previewInterfaceVersion, subscribeToInterfaceVersion, type InterfaceVersion } from "../lib/interface-version";
import { clearStoredTheme, clearThemePreview, getServerTheme, getStoredTheme, previewTheme, subscribeToTheme, type Theme } from "../lib/theme";

type Translate = (english: string, chinese: string) => string;

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="advanced-color-control">
      <span>{label}</span>
      <span><ColorPicker value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span>
    </label>
  );
}

function RangeControl({ label, value, minimum, maximum, onChange }: { label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void }) {
  return (
    <label className="advanced-range-control">
      <span>{label}<output>{value}px</output></span>
      <Slider min={minimum} max={maximum} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function AdvancedUiSettings({ t }: { t: Translate }) {
  const router = useRouter();
  const [draft, setDraft] = useState(defaultUiCustomization);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const draftRef = useRef(defaultUiCustomization);
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get("saved") === "1") {
      queueMicrotask(() => { if (!cancelled) setSaved(true); });
    }
    const stored = getPreviewUiCustomization() ?? getSavedUiCustomization();
    if (stored) {
      previewUiCustomization(stored);
      queueMicrotask(() => {
        if (!cancelled) {
          draftRef.current = stored;
          setDraft(stored);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof UiCustomization>(key: K, value: UiCustomization[K]) {
    setSaved(false);
    setSaveError("");
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDraft(next);
    previewDraftUiCustomization(next);
  }

  function updateInterfaceVersion(version: InterfaceVersion) {
    setSaved(false);
    previewInterfaceVersion(version);
    previewDraftUiCustomization(draftRef.current);
  }

  function updateThemeMode(nextTheme: Theme) {
    setSaved(false);
    previewTheme(nextTheme);
    previewDraftUiCustomization(draftRef.current);
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/__dev/ui-customization", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Aivirteach-Theme-Editor": "save" },
        body: JSON.stringify({ interfaceVersion, theme, ...draftRef.current }),
      });
      if (!response.ok) throw new Error("Theme file could not be saved. Start the local development server with npm run dev.");
      const next = await response.json() as UiCustomization;
      clearStoredUiCustomization();
      clearStoredInterfaceVersion();
      clearStoredTheme();
      clearUiCustomizationDraft();
      clearInterfaceVersionPreview();
      clearThemePreview();
      previewUiCustomization(next);
      draftRef.current = next;
      setDraft(next);
      setSaved(true);
      window.location.assign("/settings?tab=advanced&saved=1");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Theme file could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    draftRef.current = defaultUiCustomization;
    setDraft(defaultUiCustomization);
    previewInterfaceVersion("neubrutal");
    previewTheme("light");
    previewDraftUiCustomization(defaultUiCustomization);
    setSaved(false);
  }

  function discard() {
    clearUiCustomizationDraft();
    clearInterfaceVersionPreview();
    clearThemePreview();
    const savedSettings = getSavedUiCustomization() ?? defaultUiCustomization;
    draftRef.current = savedSettings;
    setDraft(savedSettings);
    setSaved(false);
    setSaveError("");
  }

  return (
    <section className="advanced-settings" aria-label={t("Advanced theme settings", "高级主题设置")}>
      <div className="advanced-settings-intro">
        <div><p className="eyebrow">{t("DESIGN SYSTEM", "设计系统")}</p><h2>{t("Site-wide theme editor", "全站主题编辑器")}</h2></div>
        <p>{t("Edit the live preview, visit the dashboard to inspect the site, then save your theme to the frontend repo. Commit the JSON file to carry it into your next build.", "实时预览修改，前往仪表板查看网站，然后将主题保存到前端仓库。提交 JSON 文件后，下次构建会沿用这些设置。")}</p>
      </div>

      <div className="advanced-settings-layout">
        <aside className="advanced-controls">
          <fieldset><legend>{t("Interface style", "界面风格")}</legend>
            <label className="advanced-select-control">
              <span>{t("Visual style", "视觉风格")}</span>
              <Select value={interfaceVersion} onChange={(event) => updateInterfaceVersion(event.target.value as InterfaceVersion)}>
                <option value="v1">{t("Original V1", "原版 V1")}</option>
                <option value="v2">{t("Modern V2", "现代 V2")}</option>
                <option value="soft">{t("Soft neumorphism", "柔和新拟态")}</option>
                <option value="soft-brutal">{t("Soft brutalism", "柔和粗野主义")}</option>
                <option value="brutal">{t("Brutalism V2", "粗野主义 V2")}</option>
                <option value="neubrutal">{t("Neubrutalism", "新粗野主义")}</option>
              </Select>
            </label>
          </fieldset>
          <fieldset><legend>{t("Theme mode", "主题模式")}</legend>
            <p className="advanced-control-description">{t("Switch modes while editing to preview each palette.", "编辑时切换模式以预览每套配色。")}</p>
            <Button type="button" variant="outline" onClick={() => updateThemeMode(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? t("Light", "浅色") : t("Dark", "深色")}
            </Button>
          </fieldset>
          <fieldset><legend>{t("Brand and feedback", "品牌与反馈")}</legend>
            <ColorControl label={t("Accent color", "强调色")} value={draft.accentColor} onChange={(value) => update("accentColor", value)} />
            <ColorControl label={t("Focused field border", "字段聚焦边框")} value={draft.focusBorder} onChange={(value) => update("focusBorder", value)} />
            <ColorControl label={t("Menu item hover", "菜单项悬停色")} value={draft.menuItemHover} onChange={(value) => update("menuItemHover", value)} />
          </fieldset>
          <fieldset><legend>{t("Buttons", "按钮")}</legend>
            <ColorControl label={t("Background", "背景色")} value={draft.buttonBackground} onChange={(value) => update("buttonBackground", value)} />
            <ColorControl label={t("Text", "文字颜色")} value={draft.buttonText} onChange={(value) => update("buttonText", value)} />
            <ColorControl label={t("Focused/selected background", "聚焦/选中背景色")} value={draft.buttonFocusBackground} onChange={(value) => update("buttonFocusBackground", value)} />
            <RangeControl label={t("Height", "高度")} value={draft.buttonHeight} minimum={28} maximum={72} onChange={(value) => update("buttonHeight", value)} />
            <RangeControl label={t("Font size", "字号")} value={draft.buttonFontSize} minimum={11} maximum={22} onChange={(value) => update("buttonFontSize", value)} />
            <RangeControl label={t("Corner radius", "圆角")} value={draft.buttonRadius} minimum={0} maximum={32} onChange={(value) => update("buttonRadius", value)} />
          </fieldset>
          <fieldset><legend>{t("Learning Path buttons", "学习路径按钮")}</legend>
            <p className="advanced-control-description">{t("Styles Previous, Next, and Mark lesson complete in the Learning Lab.", "设置学习实验室中上一节、下一节和标记本节已学完按钮的样式。")}</p>
            <ColorControl label={t("Unfocused background", "未聚焦背景色")} value={draft.learningPathButtonBackground} onChange={(value) => update("learningPathButtonBackground", value)} />
            <ColorControl label={t("Focused / hovered background", "聚焦／悬停背景色")} value={draft.learningPathButtonFocusBackground} onChange={(value) => update("learningPathButtonFocusBackground", value)} />
            <ColorControl label={t("Text", "文字颜色")} value={draft.learningPathButtonText} onChange={(value) => update("learningPathButtonText", value)} />
            <ColorControl label={t("Border", "边框颜色")} value={draft.learningPathButtonBorder} onChange={(value) => update("learningPathButtonBorder", value)} />
            <RangeControl label={t("Height", "高度")} value={draft.learningPathButtonHeight} minimum={32} maximum={72} onChange={(value) => update("learningPathButtonHeight", value)} />
            <RangeControl label={t("Font size", "字号")} value={draft.learningPathButtonFontSize} minimum={11} maximum={22} onChange={(value) => update("learningPathButtonFontSize", value)} />
            <RangeControl label={t("Corner radius", "圆角")} value={draft.learningPathButtonRadius} minimum={0} maximum={32} onChange={(value) => update("learningPathButtonRadius", value)} />
            <label className="advanced-toggle-control"><Checkbox checked={draft.learningPathButtonShadow} onCheckedChange={(checked) => update("learningPathButtonShadow", checked)} /><span>{t("Button shadow/backdrop", "按钮阴影／背景层")}</span></label>
          </fieldset>
          <fieldset><legend>{t("Text fields and selects", "文本框与下拉框")}</legend>
            <ColorControl label={t("Background", "背景色")} value={draft.fieldBackground} onChange={(value) => update("fieldBackground", value)} />
            <ColorControl label={t("Text", "文字颜色")} value={draft.fieldText} onChange={(value) => update("fieldText", value)} />
            <ColorControl label={t("Border", "边框颜色")} value={draft.fieldBorder} onChange={(value) => update("fieldBorder", value)} />
            <RangeControl label={t("Height", "高度")} value={draft.fieldHeight} minimum={36} maximum={76} onChange={(value) => update("fieldHeight", value)} />
            <RangeControl label={t("Font size", "字号")} value={draft.fieldFontSize} minimum={12} maximum={22} onChange={(value) => update("fieldFontSize", value)} />
            <RangeControl label={t("Corner radius", "圆角")} value={draft.fieldRadius} minimum={0} maximum={32} onChange={(value) => update("fieldRadius", value)} />
          </fieldset>
          <fieldset><legend>{t("Cards", "卡片")}</legend>
            <ColorControl label={t("Background", "背景色")} value={draft.cardBackground} onChange={(value) => update("cardBackground", value)} />
            <ColorControl label={t("Border", "边框颜色")} value={draft.cardBorder} onChange={(value) => update("cardBorder", value)} />
            <RangeControl label={t("Corner radius", "圆角")} value={draft.cardRadius} minimum={0} maximum={32} onChange={(value) => update("cardRadius", value)} />
            <RangeControl label={t("Inner spacing", "内边距")} value={draft.cardPadding} minimum={8} maximum={48} onChange={(value) => update("cardPadding", value)} />
          </fieldset>
          {theme === "light" ? (
            <>
              <fieldset><legend>{t("Dashboard cards — light", "仪表板卡片 — 浅色")}</legend>
                <ColorControl label={t("Current course", "当前课程")} value={draft.dashboardCourseCard} onChange={(value) => update("dashboardCourseCard", value)} />
                <ColorControl label={t("Current streak", "连续学习")} value={draft.dashboardStreakCard} onChange={(value) => update("dashboardStreakCard", value)} />
                <ColorControl label={t("Practice time", "练习时间")} value={draft.dashboardPracticeCard} onChange={(value) => update("dashboardPracticeCard", value)} />
                <ColorControl label={t("Skills mastered", "已掌握技能")} value={draft.dashboardSkillsCard} onChange={(value) => update("dashboardSkillsCard", value)} />
              </fieldset>
              <fieldset><legend>{t("Progress cards — light", "学习进度卡片 — 浅色")}</legend>
                <ColorControl label={t("Practice metric", "练习指标")} value={draft.progressPracticeCard} onChange={(value) => update("progressPracticeCard", value)} />
                <ColorControl label={t("Tasks metric", "任务指标")} value={draft.progressTasksCard} onChange={(value) => update("progressTasksCard", value)} />
                <ColorControl label={t("Weekly goal", "每周目标")} value={draft.progressGoalCard} onChange={(value) => update("progressGoalCard", value)} />
                <ColorControl label={t("Learning chart", "学习图表")} value={draft.progressChartCard} onChange={(value) => update("progressChartCard", value)} />
                <ColorControl label={t("Achievement 1", "成就 1")} value={draft.progressAchievement1} onChange={(value) => update("progressAchievement1", value)} />
                <ColorControl label={t("Achievement 2", "成就 2")} value={draft.progressAchievement2} onChange={(value) => update("progressAchievement2", value)} />
                <ColorControl label={t("Achievement 3", "成就 3")} value={draft.progressAchievement3} onChange={(value) => update("progressAchievement3", value)} />
                <ColorControl label={t("Achievement 4", "成就 4")} value={draft.progressAchievement4} onChange={(value) => update("progressAchievement4", value)} />
              </fieldset>
            </>
          ) : (
            <>
              <fieldset><legend>{t("Dark theme main/base colors", "深色主题主色与基础色")}</legend>
                <ColorControl label={t("Page background", "页面背景")} value={draft.darkBackground} onChange={(value) => update("darkBackground", value)} />
                <ColorControl label={t("Main surface", "主要表面")} value={draft.darkSurface} onChange={(value) => update("darkSurface", value)} />
                <ColorControl label={t("Muted surface", "次要表面")} value={draft.darkSurfaceMuted} onChange={(value) => update("darkSurfaceMuted", value)} />
                <ColorControl label={t("Main text", "主要文字")} value={draft.darkText} onChange={(value) => update("darkText", value)} />
                <ColorControl label={t("Muted text", "次要文字")} value={draft.darkTextMuted} onChange={(value) => update("darkTextMuted", value)} />
                <ColorControl label={t("Borders and shadows", "边框与阴影")} value={draft.darkBorder} onChange={(value) => update("darkBorder", value)} />
                <ColorControl label={t("Primary accent", "主要强调色")} value={draft.darkPrimary} onChange={(value) => update("darkPrimary", value)} />
                <ColorControl label={t("Secondary accent", "次要强调色")} value={draft.darkSecondary} onChange={(value) => update("darkSecondary", value)} />
              </fieldset>
              <fieldset><legend>{t("Dashboard cards — dark", "仪表板卡片 — 深色")}</legend>
                <ColorControl label={t("Current course", "当前课程")} value={draft.darkDashboardCourseCard} onChange={(value) => update("darkDashboardCourseCard", value)} />
                <ColorControl label={t("Current streak", "连续学习")} value={draft.darkDashboardStreakCard} onChange={(value) => update("darkDashboardStreakCard", value)} />
                <ColorControl label={t("Practice time", "练习时间")} value={draft.darkDashboardPracticeCard} onChange={(value) => update("darkDashboardPracticeCard", value)} />
                <ColorControl label={t("Skills mastered", "已掌握技能")} value={draft.darkDashboardSkillsCard} onChange={(value) => update("darkDashboardSkillsCard", value)} />
              </fieldset>
              <fieldset><legend>{t("Progress cards — dark", "学习进度卡片 — 深色")}</legend>
                <ColorControl label={t("Practice metric", "练习指标")} value={draft.darkProgressPracticeCard} onChange={(value) => update("darkProgressPracticeCard", value)} />
                <ColorControl label={t("Tasks metric", "任务指标")} value={draft.darkProgressTasksCard} onChange={(value) => update("darkProgressTasksCard", value)} />
                <ColorControl label={t("Weekly goal", "每周目标")} value={draft.darkProgressGoalCard} onChange={(value) => update("darkProgressGoalCard", value)} />
                <ColorControl label={t("Learning chart", "学习图表")} value={draft.darkProgressChartCard} onChange={(value) => update("darkProgressChartCard", value)} />
                <ColorControl label={t("Achievement 1", "成就 1")} value={draft.darkProgressAchievement1} onChange={(value) => update("darkProgressAchievement1", value)} />
                <ColorControl label={t("Achievement 2", "成就 2")} value={draft.darkProgressAchievement2} onChange={(value) => update("darkProgressAchievement2", value)} />
                <ColorControl label={t("Achievement 3", "成就 3")} value={draft.darkProgressAchievement3} onChange={(value) => update("darkProgressAchievement3", value)} />
                <ColorControl label={t("Achievement 4", "成就 4")} value={draft.darkProgressAchievement4} onChange={(value) => update("darkProgressAchievement4", value)} />
              </fieldset>
            </>
          )}
          <div className="advanced-save-actions">
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>{t("Preview site", "预览网站")}</Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? t("Saving…", "保存中…") : t("Save site-wide to repo", "保存全站设置到仓库")}</Button>
            <Button type="button" variant="outline" onClick={reset}>{t("Reset draft to defaults", "将草稿重置为默认值")}</Button>
            <Button type="button" variant="ghost" onClick={discard}>{t("Discard preview", "放弃预览")}</Button>
            {saved && <span role="status">{t("Saved to app/lib/site-ui-customization.json. Commit and push this file to share the theme.", "已保存到 app/lib/site-ui-customization.json。提交并推送此文件即可共享主题。")}</span>}
            {saveError && <span className="advanced-save-error" role="alert">{t(saveError, "无法保存主题文件。请在本地运行 npm run dev 后重试。")}</span>}
          </div>
        </aside>

        <div className="component-catalog">
          <Card as="section" className="component-preview-card"><h3>{t("Buttons", "按钮")}</h3><div className="component-preview-row"><Button>{t("Primary", "主要")}</Button><Button variant="secondary">{t("Secondary", "次要")}</Button><Button variant="outline">{t("Outline", "轮廓")}</Button><Button variant="destructive">{t("Delete", "删除")}</Button></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Learning Path buttons", "学习路径按钮")}</h3><p className="advanced-control-description">{t("Hover over or tab to a button to preview its focused color.", "将鼠标悬停在按钮上，或按 Tab 键聚焦按钮，以预览聚焦颜色。")}</p><div className="component-preview-row"><Button className="learning-path-button" variant="outline" type="button">{t("Previous", "上一节")}</Button><Button className="learning-path-button" variant="outline" type="button">{t("Next", "下一节")}</Button><Button className="learning-path-button" variant="outline" type="button">{t("Mark lesson complete", "标记本节已学完")}</Button></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Form controls", "表单控件")}</h3><div className="component-preview-form"><Input aria-label={t("Text field preview", "文本框预览")} placeholder={t("Click to test the focus border", "点击测试聚焦边框")} /><Select aria-label={t("Select preview", "下拉框预览")} defaultValue="one"><option value="one">{t("Select option", "选择选项")}</option><option value="two">{t("Another option", "另一个选项")}</option></Select><label><Checkbox defaultChecked /> {t("Checkbox", "复选框")}</label></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Status and feedback", "状态与反馈")}</h3><div className="component-preview-row"><Badge>{t("Badge", "徽章")}</Badge><Badge variant="secondary">{t("Secondary", "次要")}</Badge><Avatar><AvatarFallback>AI</AvatarFallback></Avatar></div><Progress value={64} /><Alert><AlertTitle>{t("Alert title", "提醒标题")}</AlertTitle><AlertDescription>{t("Reusable feedback message preview.", "可复用反馈消息预览。")}</AlertDescription></Alert></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Loading states", "加载状态")}</h3><div className="component-skeleton-preview"><Skeleton /><Skeleton /><Skeleton /></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Overlays", "浮层组件")}</h3><div className="component-preview-row"><Button variant="outline" type="button" onClick={() => setDialogOpen(true)}>{t("Open dialog", "打开对话框")}</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>{t("Open menu", "打开菜单")}</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>{t("Menu item", "菜单项")}</DropdownMenuItem><DropdownMenuItem variant="destructive">{t("Destructive item", "危险操作")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogTitle>{t("Dialog preview", "对话框预览")}</DialogTitle><DialogDescription>{t("Dialogs inherit the saved global component tokens.", "对话框会继承已保存的全局组件变量。")}</DialogDescription><DialogFooter><Button type="button" onClick={() => setDialogOpen(false)}>{t("Done", "完成")}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
