import React, { useEffect, useMemo } from 'react';
import { Button } from 'antd';
import { GlobalRegistry } from '@designable/core';
import { createFormDesigner, loadFormSchema, readFormSchema } from 'flowform-designable-bridge';
import { Designer, StudioPanel, CompositePanel, ResourceWidget, Workspace, WorkspacePanel, ToolbarPanel, DesignerToolsWidget, ViewToolsWidget, ViewportPanel, ViewPanel, ComponentTreeWidget, SettingsPanel, OutlineTreeWidget, IconWidget } from '@designable/react';
import { SettingsForm } from '@designable/react-settings-form';
import { Form, Field, Input, Card, Switch } from '@designable/formily-antd';
import { SchemaNode } from './api';
import { DesignableShadowSVG } from './DesignableShadowSVG';

// @designable/react beta.45's ShadowSVG creates a second Shadow Root in StrictMode.
IconWidget.ShadowSVG = DesignableShadowSVG;
GlobalRegistry.setDesignerLanguage('zh-CN');
const treeComponents = { Form, Field, Input, Card, Switch };
const DDesigner: any = Designer;
const DStudioPanel: any = StudioPanel;
const DCompositePanel: any = CompositePanel;
const DCompositeItem: any = (CompositePanel as any).Item;
const DWorkspace: any = Workspace;
const DWorkspacePanel: any = WorkspacePanel;
const DToolbarPanel: any = ToolbarPanel;
const DViewportPanel: any = ViewportPanel;
const DViewPanel: any = ViewPanel;
const DSettingsPanel: any = SettingsPanel;
export const DesignerShell: React.FC<{ schema: SchemaNode; mode: 'template' | 'config'; onSave: (schema: SchemaNode) => void; onPublish: (schema: SchemaNode) => void; onReadFields?: (schema: SchemaNode) => void }> = ({ schema, mode, onSave, onPublish, onReadFields }) => {
  const engine = useMemo(() => createFormDesigner('lowcode'), []);
  useEffect(() => { loadFormSchema(engine, schema as any); }, [engine, schema]);
  const current = () => readFormSchema(engine) as unknown as SchemaNode;
  return <div style={{ height: 'calc(100vh - 135px)', minHeight: 520 }}>
    <DDesigner engine={engine}>
      <DStudioPanel actions={<div style={{ padding: 8, display: 'flex', gap: 8 }}>{mode === 'config' && <Button onClick={() => onReadFields?.(current())}>读取设计字段</Button>}<Button onClick={() => onSave(current())}>保存草稿</Button><Button type="primary" onClick={() => onPublish(current())}>发布</Button></div>}>
        <DCompositePanel>
          <DCompositeItem title="组件" icon="Component"><ResourceWidget title="基础" sources={mode === 'template' ? [Input, Card] : [Input, Switch]} /></DCompositeItem>
          <DCompositeItem title="大纲" icon="Outline"><OutlineTreeWidget /></DCompositeItem>
        </DCompositePanel>
        <DWorkspace id="lowcode">
          <DWorkspacePanel>
            <DToolbarPanel><DesignerToolsWidget /><ViewToolsWidget /></DToolbarPanel>
            <DViewportPanel style={{ height: '100%' }}><DViewPanel type="DESIGNABLE">{() => <ComponentTreeWidget components={treeComponents} />}</DViewPanel></DViewportPanel>
          </DWorkspacePanel>
        </DWorkspace>
        <DSettingsPanel title="属性"><SettingsForm /></DSettingsPanel>
      </DStudioPanel>
    </DDesigner>
  </div>;
};
