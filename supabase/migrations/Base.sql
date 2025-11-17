-- Section 1: Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'vet', 'client');

-- Section 2: Tables
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  cost numeric NOT NULL CHECK (cost >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reorder_level integer NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL CHECK (quantity != 0),  -- Optimized: Prevent zero-quantity movements
  movement_type text NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  total numeric NOT NULL CHECK (total >= 0),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  species text NOT NULL,
  breed text,
  sex text CHECK (sex IN ('macho', 'hembra')),
  color text,
  birth_date date,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES public.pets(id) ON DELETE CASCADE UNIQUE NOT NULL,
  general_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinical_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid REFERENCES public.clinical_records(id) ON DELETE CASCADE NOT NULL,
  vet_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  diagnosis text,
  treatment text,
  prescriptions text,
  weight numeric,
  temperature numeric,
  next_appointment date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE CASCADE NOT NULL,
  vet_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('presencial', 'teleconsulta')),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz,
  reason text NOT NULL,
  teleconference_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Section 3: Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Section 4: Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.raw_user_meta_data->>'phone'
  );

  -- Assign default role (client)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type = 'IN' THEN
    UPDATE public.products
    SET stock = stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type IN ('OUT', 'ADJUST') THEN
    -- Optimized: Check for sufficient stock to prevent negatives
    IF (SELECT stock FROM public.products WHERE id = NEW.product_id) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
    END IF;
    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_sale_item_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Optimized: Check stock before movement
  IF (SELECT stock FROM public.products WHERE id = NEW.product_id) < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;

  -- Insert inventory movement
  INSERT INTO public.inventory_movements (product_id, quantity, movement_type, reason)
  VALUES (NEW.product_id, NEW.quantity, 'OUT', 'Venta #' || NEW.sale_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_clinical_record_for_pet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinical_records (pet_id, general_notes)
  VALUES (NEW.id, 'Historia clínica creada automáticamente');
  RETURN NEW;
END;
$$;

-- Section 5: Triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_inventory_movement_created
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_inventory_movement();

CREATE TRIGGER on_sale_item_created
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sale_item_created();

CREATE TRIGGER on_pet_created
  AFTER INSERT ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.create_clinical_record_for_pet();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Section 6: RLS Policies (Consolidated and Optimized)
-- Profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- User Roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can view client roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') AND role = 'client');

-- Products
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can view products"
  ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view products"
  ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client') OR public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Inventory Movements
CREATE POLICY "Admins can manage inventory movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can view inventory movements"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Sales
CREATE POLICY "Admins and vets can manage sales"
  ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vet'));

CREATE POLICY "Clients can view their own sales"
  ON public.sales FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Clients can create their own sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() = customer_id AND public.has_role(auth.uid(), 'client'));

-- Sale Items
CREATE POLICY "Admins and vets can manage sale items"
  ON public.sale_items FOR ALL TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vet'))
    AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id)
  );

CREATE POLICY "Clients can view their sale items"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id AND sales.customer_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create sale items for their sales"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id AND sales.customer_id = auth.uid()
    )
  );

-- Pets
CREATE POLICY "Clients can view their own pets"
  ON public.pets FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Clients can manage their own pets"
  ON public.pets FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Vets can view all pets"
  ON public.pets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can create pets"
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Clinical Records
CREATE POLICY "Clients can view their pets' records"
  ON public.clinical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pets
      WHERE pets.id = clinical_records.pet_id AND pets.owner_id = auth.uid()
    )
  );

CREATE POLICY "Vets can view all clinical records"
  ON public.clinical_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can manage clinical records"
  ON public.clinical_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Clinical Entries
CREATE POLICY "Clients can view their pets' clinical entries"
  ON public.clinical_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinical_records cr
      JOIN public.pets p ON p.id = cr.pet_id
      WHERE cr.id = clinical_entries.record_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Vets can view all clinical entries"
  ON public.clinical_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can create clinical entries"
  ON public.clinical_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE POLICY "Clients can view their own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Vets can view their appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vets can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'));

-- Section 7: Storage Buckets and Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pet-photos', 'pet-photos', true, NULL, NULL),
  ('invoices', 'invoices', false, 52428800, ARRAY['application/pdf']),
  ('attachments', 'attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Pet Photos
CREATE POLICY "Pet photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-photos');

CREATE POLICY "Authenticated users can upload pet photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pet-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Pet owners can update their pet photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pet-photos' AND auth.role() = 'authenticated');

-- Invoices
CREATE POLICY "Clients can view their own invoices"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can manage all invoices"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'invoices' AND
    public.has_role(auth.uid(), 'admin')
  );

-- Attachments
CREATE POLICY "Users can view their pet attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Vets and admins can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments' AND
    (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Vets and admins can update attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments' AND
    (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Vets and admins can delete attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    (public.has_role(auth.uid(), 'vet') OR public.has_role(auth.uid(), 'admin'))
  );

-- Section 8: Indexes (Optimizations for performance)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON public.pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_pet_id ON public.clinical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_clinical_entries_record_id ON public.clinical_entries(record_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON public.appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_vet_id ON public.appointments(vet_id);
