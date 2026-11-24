-- Sucursales (RF-32). Cada local pasa a ser una marca con una o más sedes.
-- Se crea una sucursal por local con los datos que hoy viven en el local
-- (coordenadas y ficha de Google Maps), y se le asignan todos sus tags,
-- sellos y canjes. Después se quitan esas columnas del local.
CREATE TABLE "sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"lat" text,
	"lng" text,
	"google_maps_url" text,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sucursales_local_nombre_unico" UNIQUE("local_id","nombre")
);
--> statement-breakpoint
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sucursales_local_idx" ON "sucursales" USING btree ("local_id");--> statement-breakpoint
INSERT INTO "sucursales" ("local_id", "nombre", "lat", "lng", "google_maps_url", "creado_en")
	SELECT "id", 'Principal', "lat", "lng", "google_maps_url", "creado_en" FROM "locales";--> statement-breakpoint
ALTER TABLE "canjes" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
ALTER TABLE "sellos" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
UPDATE "tags" t SET "sucursal_id" = s."id" FROM "sucursales" s WHERE s."local_id" = t."local_id";--> statement-breakpoint
UPDATE "sellos" x SET "sucursal_id" = s."id" FROM "sucursales" s WHERE s."local_id" = x."local_id";--> statement-breakpoint
UPDATE "canjes" x SET "sucursal_id" = s."id" FROM "sucursales" s WHERE s."local_id" = x."local_id";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "sucursal_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellos" ADD CONSTRAINT "sellos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locales" DROP COLUMN "lat";--> statement-breakpoint
ALTER TABLE "locales" DROP COLUMN "lng";--> statement-breakpoint
ALTER TABLE "locales" DROP COLUMN "google_maps_url";
