import React from "react";
import ProductDefinition from "../productDefinition/ProductionDefinition";

// See ProductDefinition for onFormToggle / addSignal / onChanged.
const ProductDefinitionCatComp = ({ categoryId, onFormToggle, addSignal, onChanged }) => {
  return (
    <div className=" text-sm font-medium text-gray-700">
      <ProductDefinition
        categoryId={categoryId}
        lockCategory={true}
        onFormToggle={onFormToggle}
        addSignal={addSignal}
        onChanged={onChanged}
      />
    </div>
  );
};

export default ProductDefinitionCatComp;
