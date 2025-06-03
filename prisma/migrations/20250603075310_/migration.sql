-- AlterTable
CREATE SEQUENCE profile_order_seq;
ALTER TABLE "Profile" ALTER COLUMN "isActive" SET DEFAULT false,
ALTER COLUMN "order" SET DEFAULT nextval('profile_order_seq');
ALTER SEQUENCE profile_order_seq OWNED BY "Profile"."order";
