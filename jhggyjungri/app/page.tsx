import ColdMedApp from "@/components/ColdMedApp";
import classes from "@/data/classes.json";
import ingredients from "@/data/ingredients.json";
import series from "@/data/series.json";
import products from "@/data/products.json";
import type { Classes, Ingredient, Product, Series } from "@/lib/types";

// 빌드할 때 data/*.json 을 읽어 정적 페이지(SSG)로 만듭니다.
export default function Page() {
  return (
    <ColdMedApp
      classes={classes as Classes}
      ingredients={ingredients as Ingredient[]}
      series={series as Series[]}
      products={products as unknown as Product[]}
    />
  );
}
