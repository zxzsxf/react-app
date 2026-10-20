import React, { createContext, useContext, useMemo } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { connect, mapProps, useField } from '@formily/react';
import { FormItem } from '@formily/antd';
import { MobileFormRenderer } from 'flowform-mobile';
import type { MobileFormHandle } from 'flowform-mobile';
import { ReactRemoteComponent } from 'remote-component-loader';
import { ComponentLock, SchemaNode } from './api';
import { SchemaDropTarget } from './schema-drag';

export type { MobileFormHandle };
export interface LowCodeRendererProps {
  schema: SchemaNode;
  locks: Record<string, ComponentLock>;
  formRef?: React.Ref<MobileFormHandle>;
  onSelect?: (path: string) => void;
  selectedPath?: string;
  onRemove?: (path: string) => void;
  draggable?: boolean;
  dropTarget?: SchemaDropTarget | null;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
}
const EditorContext = createContext<Pick<LowCodeRendererProps, 'onSelect' | 'selectedPath' | 'onRemove' | 'draggable' | 'dropTarget'>>({});

interface EditorSchema extends SchemaNode {
  'x-decorator-props'?: Record<string, unknown>;
}

const editorDecorator = 'LowCodeEditorItem';

const wrapEditorSchema = (node: EditorSchema, locks: LowCodeRendererProps['locks']): EditorSchema => {
  const next = { ...node };
  if (node.properties) {
    next.properties = Object.fromEntries(
      Object.entries(node.properties).map(([key, child]) => [key, wrapEditorSchema(child, locks)]),
    );
  }
  if (node['x-component'] && locks[node['x-component']]) {
    next['x-decorator'] = editorDecorator;
    next['x-decorator-props'] = {
      ...node['x-decorator-props'],
      originalDecorator: node['x-decorator'],
    };
  }
  return next;
};

export const LowCodeRenderer: React.FC<LowCodeRendererProps> = ({
  schema,
  locks,
  formRef,
  onSelect,
  selectedPath,
  onRemove,
  draggable,
  dropTarget,
  onSubmit,
}) => {
  const componentsData = useMemo(() => {
    const result: Record<string, React.ComponentType<any>> = {};
    Object.entries(locks).forEach(([schemaName, lock]) => {
      const Remote: React.FC<any> = (props) => {
        return (
          <ReactRemoteComponent
            name={lock.remoteName}
            version={lock.version}
            componentProps={{ ...props, field: undefined }}
          />
        );
      };
      result[schemaName] = connect(Remote, mapProps((props: any, field: any) => ({ ...props, field })));
    });
    const decorators = { FormItem, ...result };
    const EditorItem: React.FC<any> = ({ originalDecorator, children, ...props }) => {
      const editor = useContext(EditorContext);
      const field = useField();
      const path = field.address.toString();
      const schemaName = field.componentType as string;
      const label = locks[schemaName]?.displayName || schemaName;
      const Decorator = decorators[originalDecorator as keyof typeof decorators];
      const content = Decorator ? <Decorator {...props}>{children}</Decorator> : children;
      return (
        <div
          className={`lowcode-editor-node${editor.selectedPath === path ? ' is-selected' : ''}${editor.dropTarget?.path === path ? ` is-drop-${editor.dropTarget.placement}` : ''}`}
          data-lowcode-path={path}
          draggable={editor.draggable}
          tabIndex={0}
          aria-label={`选择${label}组件`}
          onClick={(event) => {
            event.stopPropagation();
            editor.onSelect?.(path);
          }}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              event.stopPropagation();
              editor.onSelect?.(path);
            }
          }}
        >
          {editor.selectedPath === path && editor.onRemove && (
            <Button
              className="lowcode-editor-node-remove"
              type="text"
              size="small"
              icon={<CloseOutlined />}
              aria-label={`删除${label}组件`}
              onClick={(event) => {
                event.stopPropagation();
                editor.onRemove?.(path);
              }}
            />
          )}
          <div className="lowcode-editor-node-content">{content}</div>
        </div>
      );
    };
    result[editorDecorator] = EditorItem;
    return result;
  }, [locks]);
  const editing = Boolean(onSelect);
  const renderSchema = useMemo(
    () => editing ? wrapEditorSchema(schema, locks) : schema,
    [schema, locks, editing],
  );
  return (
    <EditorContext.Provider value={{ onSelect, selectedPath, onRemove, draggable, dropTarget }}>
      <MobileFormRenderer
        key={editing ? `editor:${JSON.stringify(schema)}` : 'preview'}
        ref={formRef}
        schema={renderSchema}
        componentsData={componentsData}
        onSubmit={onSubmit}
      />
    </EditorContext.Provider>
  );
};
