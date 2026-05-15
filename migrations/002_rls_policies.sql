-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- POLICIES FOR TASKS
-- ==========================================
-- Admins can do everything to tasks
CREATE POLICY "Admins have full access to tasks" ON public.tasks FOR ALL USING (is_admin());

-- Users can only view and update their assigned tasks
CREATE POLICY "Users can view assigned tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update assigned tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- POLICIES FOR GENERATED IMAGES
-- ==========================================
-- Admins have full access
CREATE POLICY "Admins have full access to images" ON public.generated_images FOR ALL USING (is_admin());

-- Users can view, insert, and update images linked to their tasks
CREATE POLICY "Users can manage images for their tasks" ON public.generated_images FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = generated_images.task_id AND tasks.user_id = auth.uid()
  )
);