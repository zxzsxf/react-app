import React, { useMemo } from 'react';
import { connect, mapProps } from '@formily/react';
import { MobileFormRenderer } from 'flowform-mobile';
import type { MobileFormHandle } from 'flowform-mobile';
import { ReactRemoteComponent } from 'remote-component-loader';
import { ComponentLock, SchemaNode } from './api';

export type { MobileFormHandle };
export interface LowCodeRendererProps {
  schema: SchemaNode;
  locks: Record<string, ComponentLock>;
  formRef?: React.Ref<MobileFormHandle>;
  onSelect?: (path: string) => void;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
}
export const LowCodeRenderer: React.FC<LowCodeRendererProps> = ({ schema, locks, formRef, onSelect, onSubmit }) => {
  const componentsData = useMemo(() => {
    const result: Record<string, React.ComponentType<any>> = {};
    Object.entries(locks).forEach(([schemaName, lock]) => {
      const Remote: React.FC<any> = props => <div data-lowcode-path={props.field?.path?.toString()} onClick={event => { if (onSelect && props.field?.path) { event.stopPropagation(); onSelect(props.field.path.toString()); } }}>
        <ReactRemoteComponent name={lock.remoteName} version={lock.version} componentProps={{ ...props, field: undefined }} />
      </div>;
      result[schemaName] = connect(Remote, mapProps((props: any, field: any) => ({ ...props, field })));
    });
    return result;
  }, [locks, onSelect]);
  return <MobileFormRenderer ref={formRef} schema={schema} componentsData={componentsData} onSubmit={onSubmit} />;
};
