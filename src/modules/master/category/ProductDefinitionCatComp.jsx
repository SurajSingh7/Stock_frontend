import React from "react";
import ProductDefinition from "../productDefinition/ProductionDefinition";

const ProductDefinitionCatComp = ({ categoryId }) => {
  return (
    <div className=" text-sm font-medium text-gray-700">
      <ProductDefinition categoryId={categoryId} lockCategory={true} />
    </div>
  );
};

export default ProductDefinitionCatComp;