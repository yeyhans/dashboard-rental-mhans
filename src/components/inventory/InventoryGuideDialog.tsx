import { BookOpen } from "lucide-react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { GUIDE_SECTIONS, GUIDE_VOCABULARY } from "./inventoryGuideContent";

/**
 * "Guia del inventario" button plus the dialog it opens. Presentational: all copy lives in
 * `inventoryGuideContent.ts`. Used on /inventory and /products.
 */
export function InventoryGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 text-xs sm:h-9">
          <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
          Guía del inventario
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-4 py-4 pr-10 sm:px-6">
          <DialogTitle>Guía del inventario</DialogTitle>
          <DialogDescription>
            Cómo se conectan los productos, las unidades, las etiquetas y la
            bodega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 overflow-y-auto px-4 py-5 text-sm sm:px-6">
          {GUIDE_SECTIONS.map((section, index) => (
            <section
              key={section.id}
              aria-labelledby={`guide-${section.id}`}
              className="space-y-3"
            >
              <h3
                id={`guide-${section.id}`}
                className="text-base font-semibold"
              >
                {index + 1}. {section.title}
              </h3>
              {section.intro && (
                <p className="text-muted-foreground">{section.intro}</p>
              )}

              {section.table === "vocabulary" && (
                <dl className="divide-y rounded-md border">
                  {GUIDE_VOCABULARY.map((row) => (
                    <div key={row.term} className="space-y-1 p-3">
                      <dt className="font-medium">{row.term}</dt>
                      <dd className="text-muted-foreground">{row.what}</dd>
                      <dd className="text-xs">
                        <span className="font-medium">Quién lo crea: </span>
                        {row.who}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {section.groups.map((group, groupIndex) => (
                <div key={group.heading ?? groupIndex} className="space-y-2">
                  {group.heading && (
                    <h4 className="font-medium">{group.heading}</h4>
                  )}
                  <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground">
                    {group.steps.map((step) => (
                      <li key={step} className="pl-1">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}

              {section.note && (
                <p className="rounded-md border bg-muted/50 p-3 text-muted-foreground">
                  {section.note}
                </p>
              )}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InventoryGuideDialog;
