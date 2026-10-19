import React from "react";
import { ISchema } from "@formily/react";
/** Legacy factory accepting the existing `{ schemas }` envelope. */
export declare const createFlowForm: <T extends {} = any>(formSchema?: {
    schemas?: ISchema;
}) => React.FC<any>;
export default createFlowForm;
