
-- access_users: restrict SELECT to owner or super admin
DROP POLICY IF EXISTS "auth read access_users" ON public.access_users;
CREATE POLICY "own or admin read access_users" ON public.access_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- user_roles: restrict SELECT to owner or super admin
DROP POLICY IF EXISTS "authenticated read roles" ON public.user_roles;
CREATE POLICY "own or admin read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- recycle_bin: restrict SELECT to deleter or super admin
DROP POLICY IF EXISTS "auth read recycle_bin" ON public.recycle_bin;
CREATE POLICY "own or admin read recycle_bin" ON public.recycle_bin
  FOR SELECT TO authenticated
  USING (deleted_by = auth.uid() OR public.is_super_admin(auth.uid()));

-- ip_addresses: split ALL into read-all + admin-write
DROP POLICY IF EXISTS "authenticated all ip" ON public.ip_addresses;
CREATE POLICY "auth read ip" ON public.ip_addresses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write ip" ON public.ip_addresses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update ip" ON public.ip_addresses
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete ip" ON public.ip_addresses
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- printers
DROP POLICY IF EXISTS "authenticated all printers" ON public.printers;
CREATE POLICY "auth read printers" ON public.printers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write printers" ON public.printers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update printers" ON public.printers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete printers" ON public.printers
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- wifi_networks
DROP POLICY IF EXISTS "authenticated all wifi" ON public.wifi_networks;
CREATE POLICY "auth read wifi" ON public.wifi_networks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write wifi" ON public.wifi_networks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update wifi" ON public.wifi_networks
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete wifi" ON public.wifi_networks
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- sticker_buyers
DROP POLICY IF EXISTS "authenticated all sticker_buyers" ON public.sticker_buyers;
CREATE POLICY "auth read sticker_buyers" ON public.sticker_buyers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write sticker_buyers" ON public.sticker_buyers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update sticker_buyers" ON public.sticker_buyers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete sticker_buyers" ON public.sticker_buyers
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- sticker_transactions
DROP POLICY IF EXISTS "authenticated all sticker_txns" ON public.sticker_transactions;
CREATE POLICY "auth read sticker_txns" ON public.sticker_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write sticker_txns" ON public.sticker_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update sticker_txns" ON public.sticker_transactions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete sticker_txns" ON public.sticker_transactions
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
