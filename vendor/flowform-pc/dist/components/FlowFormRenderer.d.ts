import React from "react";
import { ISchema } from "@formily/react";
export interface FlowFormRendererProps {
    schema: ISchema;
    initialValues?: Record<string, unknown>;
    onChange?: (values: Record<string, unknown>) => void;
    formRef?: React.MutableRefObject<any>;
    children?: React.ReactNode;
}
export declare const FlowFormRenderer: React.FC<FlowFormRendererProps>;
export default FlowFormRenderer;
