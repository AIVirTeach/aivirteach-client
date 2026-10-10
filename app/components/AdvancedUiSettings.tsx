"use client";

import { useEffect, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  clearUiCustomization,
  defaultUiCustomization,
  getStoredUiCustomization,
  previewUiCustomization,
  removeUiCustomizationPreview,
  saveUiCustomization,
  type UiCustomization,
} from "../lib/ui-customization";

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
  const [draft, setDraft] = useState(defaultUiCustomization);
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const persistedRef = useRef<UiCustomization | null>(null);

  useEffect(() => {
    const stored = getStoredUiCustomization();
    persistedRef.current = stored;
    if (stored) {
      setDraft(stored);
      previewUiCustomization(stored);
    }
    return () => {
      if (persistedRef.current) previewUiCustomization(persistedRef.current);
      else removeUiCustomizationPreview();
    };
  }, []);

  function update<K extends keyof UiCustomization>(key: K, value: UiCustomization[K]) {
    setSaved(false);
    setDraft((current) => {
      const next = { ...current, [key]: value };
      previewUiCustomization(next);
      return next;
    });
  }

  function save() {
    saveUiCustomization(draft);
    persistedRef.current = draft;
    setSaved(true);
  }

  function reset() {
    clearUiCustomization();
    persistedRef.current = null;
    setDraft(defaultUiCustomization);
    setSaved(false);
  }

  return (
    <section className="advanced-settings" aria-label={t("Advanced component settings", "高级组件设置")}>
      <div className="advanced-settings-intro">
        <div><p className="eyebrow">{t("DESIGN SYSTEM", "设计系统")}</p><h2>{t("Site-wide component editor", "全站组件编辑器")}</h2></div>
        <p>{t("Preview reusable UI components and customize their shared design tokens. Changes are previewed live and become persistent after you save.", "预览可复用的界面组件并自定义共享设计变量。更改会实时预览，保存后将永久生效。")}</p>
      </div>

      <div className="advanced-settings-layout">
        <aside className="advanced-controls">
          <fieldset><legend>{t("Brand and feedback", "品牌与反馈")}</legend>
            <ColorControl label={t("Accent color", "强调色")} value={draft.accentColor} onChange={(value) => update("accentColor", value)} />
            <ColorControl label={t("Focused field border", "字段聚焦边框")} value={draft.focusBorder} onChange={(value) => update("focusBorder", value)} />
            <ColorControl label={t("Menu item hover", "菜单项悬停色")} value={draft.menuItemHover} onChange={(value) => update("menuItemHover", value)} />
          </fieldset>
          <fieldset><legend>{t("Buttons", "按钮")}</legend>
            <ColorControl label={t("Background", "背景色")} value={draft.buttonBackground} onChange={(value) => update("buttonBackground", value)} />
            <ColorControl label={t("Text", "文字颜色")} value={draft.buttonText} onChange={(value) => update("buttonText", value)} />
            <RangeControl label={t("Height", "高度")} value={draft.buttonHeight} minimum={28} maximum={72} onChange={(value) => update("buttonHeight", value)} />
            <RangeControl label={t("Font size", "字号")} value={draft.buttonFontSize} minimum={11} maximum={22} onChange={(value) => update("buttonFontSize", value)} />
            <RangeControl label={t("Corner radius", "圆角")} value={draft.buttonRadius} minimum={0} maximum={32} onChange={(value) => update("buttonRadius", value)} />
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
          <div className="advanced-save-actions">
            <Button type="button" onClick={save}>{t("Save site-wide", "保存到全站")}</Button>
            <Button type="button" variant="outline" onClick={reset}>{t("Reset custom styles", "重置自定义样式")}</Button>
            {saved && <span role="status">{t("Saved", "已保存")}</span>}
          </div>
        </aside>

        <div className="component-catalog">
          <Card as="section" className="component-preview-card"><h3>{t("Buttons", "按钮")}</h3><div className="component-preview-row"><Button>{t("Primary", "主要")}</Button><Button variant="secondary">{t("Secondary", "次要")}</Button><Button variant="outline">{t("Outline", "轮廓")}</Button><Button variant="destructive">{t("Delete", "删除")}</Button></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Form controls", "表单控件")}</h3><div className="component-preview-form"><Input aria-label={t("Text field preview", "文本框预览")} placeholder={t("Click to test the focus border", "点击测试聚焦边框")} /><Select aria-label={t("Select preview", "下拉框预览")} defaultValue="one"><option value="one">{t("Select option", "选择选项")}</option><option value="two">{t("Another option", "另一个选项")}</option></Select><label><Checkbox defaultChecked /> {t("Checkbox", "复选框")}</label><label><Switch defaultChecked /> {t("Switch", "开关")}</label></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Status and feedback", "状态与反馈")}</h3><div className="component-preview-row"><Badge>{t("Badge", "徽章")}</Badge><Badge variant="secondary">{t("Secondary", "次要")}</Badge><Avatar><AvatarFallback>AI</AvatarFallback></Avatar></div><Progress value={64} /><Alert><AlertTitle>{t("Alert title", "提醒标题")}</AlertTitle><AlertDescription>{t("Reusable feedback message preview.", "可复用反馈消息预览。")}</AlertDescription></Alert></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Loading states", "加载状态")}</h3><div className="component-skeleton-preview"><Skeleton /><Skeleton /><Skeleton /></div></Card>
          <Card as="section" className="component-preview-card"><h3>{t("Overlays", "浮层组件")}</h3><div className="component-preview-row"><Button variant="outline" type="button" onClick={() => setDialogOpen(true)}>{t("Open dialog", "打开对话框")}</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>{t("Open menu", "打开菜单")}</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>{t("Menu item", "菜单项")}</DropdownMenuItem><DropdownMenuItem variant="destructive">{t("Destructive item", "危险操作")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogTitle>{t("Dialog preview", "对话框预览")}</DialogTitle><DialogDescription>{t("Dialogs inherit the saved global component tokens.", "对话框会继承已保存的全局组件变量。")}</DialogDescription><DialogFooter><Button type="button" onClick={() => setDialogOpen(false)}>{t("Done", "完成")}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
