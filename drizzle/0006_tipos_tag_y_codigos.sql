CREATE TYPE "public"."tipo_tag" AS ENUM('nfc', 'qr_impreso', 'pantalla');--> statement-breakpoint
CREATE TABLE "codigos_sello" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"usado_por_cliente_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codigos_sello_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "tipo" "tipo_tag" DEFAULT 'nfc' NOT NULL;--> statement-breakpoint
ALTER TABLE "codigos_sello" ADD CONSTRAINT "codigos_sello_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_sello" ADD CONSTRAINT "codigos_sello_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_sello" ADD CONSTRAINT "codigos_sello_usado_por_cliente_id_clientes_id_fk" FOREIGN KEY ("usado_por_cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codigos_sello_tag_idx" ON "codigos_sello" USING btree ("tag_id","creado_en");--> statement-breakpoint
CREATE INDEX "codigos_sello_limpieza_idx" ON "codigos_sello" USING btree ("expira_en");