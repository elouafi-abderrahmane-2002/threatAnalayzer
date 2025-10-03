/*
  # ThreatRadar Database Schema

  1. New Tables
    - `clients` - Tenant client organizations
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `email` (text)
      - `created_at` (timestamp)
      - `settings` (jsonb)
    - `assets` - Client assets and infrastructure
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key)
      - `name` (text)
      - `ip_address` (text)
      - `status` (text)
      - `vulnerabilities` (jsonb)
      - `created_at` (timestamp)
    - `logs` - Security events and threat data
      - Enhanced with comprehensive threat detection fields
      - Added `label` column for TP/TN/FP/FN classification

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Sample Data
    - Create sample tenant clients (ORION, FFHB, BOTICINAL, etc.)
    - Generate realistic threat data with proper classifications
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb
);

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  ip_address text NOT NULL,
  status text NOT NULL CHECK (status IN ('online', 'offline', 'maintenance')),
  vulnerabilities jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create logs table with comprehensive threat detection fields
CREATE TABLE IF NOT EXISTS public.logs (
  event_id text PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  event_type text,
  severity text,
  alert_name text,
  alert_category text,
  detection_engine text,
  action_taken text,
  process_name text,
  process_path text,
  process_id integer,
  parent_process_name text,
  parent_process_id integer,
  user_name text,
  host_name text,
  host_ip text,
  file_name text,
  file_path text,
  file_hash_md5 text,
  file_hash_sha256 text,
  network_connection boolean,
  source_ip text,
  source_port integer,
  destination_ip text,
  destination_port integer,
  protocol text,
  registry_key text,
  persistence_mechanism text,
  geo_location text,
  mitre_attack_tactic text,
  mitre_attack_technique text,
  status text,
  comments text,
  label text CHECK (label IN ('TP', 'TN', 'FP', 'FN'))
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on clients" 
ON public.clients 
FOR ALL 
TO authenticated
USING (true);

CREATE POLICY "Allow all operations on assets" 
ON public.assets 
FOR ALL 
TO authenticated
USING (true);

CREATE POLICY "Allow all operations on logs" 
ON public.logs 
FOR ALL 
TO authenticated
USING (true);

-- Insert sample tenant clients
INSERT INTO public.clients (name, email, settings) VALUES
  ('ORION Corporation', 'security@orion-corp.com', '{"alert_threshold": "medium", "auto_email": true}'),
  ('FFHB Financial Group', 'soc@ffhb-financial.com', '{"alert_threshold": "high", "auto_email": false}'),
  ('BOTICINAL Pharmaceuticals', 'alerts@boticinal-pharma.com', '{"alert_threshold": "low", "auto_email": true}'),
  ('NEXUS Technologies', 'security@nexus-tech.com', '{"alert_threshold": "medium", "auto_email": true}'),
  ('QUANTUM Defense Systems', 'it-security@quantum-defense.com', '{"alert_threshold": "high", "auto_email": false}'),
  ('APEX Manufacturing', 'security@apex-mfg.com', '{"alert_threshold": "medium", "auto_email": true}'),
  ('STELLAR Communications', 'soc@stellar-comm.com', '{"alert_threshold": "low", "auto_email": false}')
ON CONFLICT (name) DO NOTHING;

-- Insert sample assets for each client
WITH client_data AS (
  SELECT id, name FROM public.clients
),
asset_templates AS (
  SELECT * FROM (VALUES 
    ('DC-SERVER-01', '192.168.1.10', 'online', '[{"cve": "CVE-2023-1234", "severity": "high", "description": "Remote code execution vulnerability"}]'::jsonb),
    ('WEB-SERVER-02', '192.168.1.20', 'online', '[]'::jsonb),
    ('DB-SERVER-03', '192.168.1.30', 'maintenance', '[{"cve": "CVE-2023-5678", "severity": "medium", "description": "SQL injection vulnerability"}]'::jsonb),
    ('WORKSTATION-04', '192.168.1.40', 'online', '[{"cve": "CVE-2023-9012", "severity": "low", "description": "Local privilege escalation"}]'::jsonb),
    ('FIREWALL-01', '192.168.1.1', 'online', '[]'::jsonb),
    ('EMAIL-SERVER-05', '192.168.1.50', 'online', '[{"cve": "CVE-2023-3456", "severity": "critical", "description": "Authentication bypass"}]'::jsonb),
    ('BACKUP-SERVER-06', '192.168.1.60', 'offline', '[{"cve": "CVE-2023-7890", "severity": "high", "description": "Directory traversal vulnerability"}]'::jsonb)
  ) AS t(asset_name, ip_addr, status_val, vulnerabilities_json)
)
INSERT INTO public.assets (client_id, name, ip_address, status, vulnerabilities)
SELECT 
  c.id,
  at.asset_name,
  at.ip_addr,
  at.status_val,
  at.vulnerabilities_json
FROM client_data c
CROSS JOIN asset_templates at
ON CONFLICT DO NOTHING;

-- Insert comprehensive threat data with proper label distribution
WITH client_data AS (
  SELECT id FROM public.clients
),
threat_templates AS (
  SELECT * FROM (VALUES 
    ('malware_detection', 'critical', 'Advanced Persistent Threat Detected', 'malware', 'CrowdStrike', 'quarantined', 'powershell.exe', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 1234, 'cmd.exe', 5678, 'SYSTEM', 'DC-SERVER-01', '192.168.1.10', 'malicious.exe', 'C:\\temp\\malicious.exe', 'a1b2c3d4e5f6', 'abc123def456ghi789', true, '10.0.0.100', 443, '192.168.1.10', 80, 'TCP', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', 'registry_persistence', 'US-East', 'Execution', 'T1059.001', 'active', 'Sophisticated malware with C2 communication detected', 'TP'),
    ('network_anomaly', 'high', 'Suspicious Network Traffic Pattern', 'network', 'Suricata', 'monitored', null, null, null, null, null, 'user1', 'WEB-SERVER-02', '192.168.1.20', null, null, null, null, true, '203.0.113.1', 22, '192.168.1.20', 22, 'SSH', null, null, 'China', 'Command and Control', 'T1071.001', 'investigating', 'Multiple failed SSH login attempts from foreign IP', 'FP'),
    ('file_modification', 'medium', 'Critical System File Modified', 'file_integrity', 'OSSEC', 'logged', 'notepad.exe', 'C:\\Windows\\System32\\notepad.exe', 2345, 'explorer.exe', 1111, 'administrator', 'WORKSTATION-04', '192.168.1.40', 'system32.dll', 'C:\\Windows\\System32\\system32.dll', 'f1e2d3c4b5a6', 'fed123cba456789def', false, null, null, null, null, null, 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft', null, 'US-West', 'Defense Evasion', 'T1112', 'resolved', 'Legitimate administrative file update', 'TN'),
    ('authentication_failure', 'high', 'Multiple Authentication Failures', 'authentication', 'Windows Security', 'blocked', 'winlogon.exe', 'C:\\Windows\\System32\\winlogon.exe', 3456, 'services.exe', 444, 'guest', 'DB-SERVER-03', '192.168.1.30', null, null, null, null, false, '198.51.100.5', null, null, null, null, null, null, 'Russia', 'Credential Access', 'T1110.001', 'blocked', 'Brute force attack blocked by security controls', 'TP'),
    ('process_injection', 'critical', 'Process Hollowing Attack Detected', 'process_behavior', 'Sysmon', 'terminated', 'svchost.exe', 'C:\\Windows\\System32\\svchost.exe', 4567, 'winlogon.exe', 3456, 'SYSTEM', 'FIREWALL-01', '192.168.1.1', 'injected.dll', 'C:\\temp\\injected.dll', 'b2c3d4e5f6a1', 'bcd456efa789123ghi', false, null, null, null, null, null, null, 'process_hollowing', 'Germany', 'Defense Evasion', 'T1055.012', 'contained', 'Advanced process injection technique neutralized', 'TP'),
    ('lateral_movement', 'high', 'Lateral Movement Attempt', 'network', 'Zeek', 'monitored', 'psexec.exe', 'C:\\Windows\\System32\\psexec.exe', 7890, 'services.exe', 444, 'admin', 'EMAIL-SERVER-05', '192.168.1.50', null, null, null, null, true, '192.168.1.10', 445, '192.168.1.50', 445, 'SMB', null, 'scheduled_task', 'Internal', 'Lateral Movement', 'T1021.002', 'investigating', 'Suspicious SMB activity between internal hosts', 'FN'),
    ('data_exfiltration', 'critical', 'Large Data Transfer Detected', 'data_loss', 'DLP Agent', 'blocked', 'chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 9876, 'explorer.exe', 1111, 'user2', 'WORKSTATION-04', '192.168.1.40', 'sensitive_data.zip', 'C:\\Users\\user2\\Documents\\sensitive_data.zip', 'c3d4e5f6a1b2', 'cde789fgh123abc456', true, '192.168.1.40', 443, '203.0.113.50', 443, 'HTTPS', null, null, 'US-West', 'Exfiltration', 'T1041', 'blocked', 'Attempted upload of classified documents blocked', 'TP'),
    ('privilege_escalation', 'high', 'Privilege Escalation Attempt', 'privilege_escalation', 'Windows Defender', 'blocked', 'cmd.exe', 'C:\\Windows\\System32\\cmd.exe', 5432, 'powershell.exe', 1234, 'guest', 'BACKUP-SERVER-06', '192.168.1.60', null, null, null, null, false, null, null, null, null, null, 'HKEY_LOCAL_MACHINE\\SAM', 'token_manipulation', 'Internal', 'Privilege Escalation', 'T1134', 'blocked', 'Guest account attempted to access admin privileges', 'TP'),
    ('dns_tunneling', 'medium', 'DNS Tunneling Activity', 'network', 'PiHole', 'monitored', null, null, null, null, null, 'system', 'DC-SERVER-01', '192.168.1.10', null, null, null, null, true, '192.168.1.10', 53, '8.8.8.8', 53, 'DNS', null, null, 'External', 'Command and Control', 'T1071.004', 'investigating', 'Unusual DNS query patterns detected', 'FP'),
    ('ransomware_behavior', 'critical', 'Ransomware Encryption Activity', 'ransomware', 'Behavioral Analysis', 'terminated', 'encrypt.exe', 'C:\\temp\\encrypt.exe', 6789, 'explorer.exe', 1111, 'user3', 'WEB-SERVER-02', '192.168.1.20', 'important.docx', 'C:\\Users\\user3\\Documents\\important.docx', 'd4e5f6a1b2c3', 'def456abc789ghi123', false, null, null, null, null, null, null, 'file_encryption', 'Internal', 'Impact', 'T1486', 'terminated', 'Ransomware process terminated before encryption completed', 'TP')
  ) AS t(event_type, severity, alert_name, alert_category, detection_engine, action_taken, process_name, process_path, process_id, parent_process_name, parent_process_id, user_name, host_name, host_ip, file_name, file_path, file_hash_md5, file_hash_sha256, network_connection, source_ip, source_port, destination_ip, destination_port, protocol, registry_key, persistence_mechanism, geo_location, mitre_attack_tactic, mitre_attack_technique, status, comments, label)
)
INSERT INTO public.logs (
  client_id, timestamp, event_id, event_type, severity, alert_name, alert_category,
  detection_engine, action_taken, process_name, process_path, process_id,
  parent_process_name, parent_process_id, user_name, host_name, host_ip,
  file_name, file_path, file_hash_md5, file_hash_sha256, network_connection,
  source_ip, source_port, destination_ip, destination_port, protocol,
  registry_key, persistence_mechanism, geo_location, mitre_attack_tactic,
  mitre_attack_technique, status, comments, label
)
SELECT 
  c.id,
  now() - (random() * interval '30 days'),
  'TRD-' || floor(random() * 100000)::text,
  tt.event_type,
  tt.severity,
  tt.alert_name,
  tt.alert_category,
  tt.detection_engine,
  tt.action_taken,
  tt.process_name,
  tt.process_path,
  tt.process_id,
  tt.parent_process_name,
  tt.parent_process_id,
  tt.user_name,
  tt.host_name,
  tt.host_ip,
  tt.file_name,
  tt.file_path,
  tt.file_hash_md5,
  tt.file_hash_sha256,
  tt.network_connection,
  tt.source_ip,
  tt.source_port,
  tt.destination_ip,
  tt.destination_port,
  tt.protocol,
  tt.registry_key,
  tt.persistence_mechanism,
  tt.geo_location,
  tt.mitre_attack_tactic,
  tt.mitre_attack_technique,
  tt.status,
  tt.comments,
  tt.label
FROM client_data c
CROSS JOIN threat_templates tt
ON CONFLICT (event_id) DO NOTHING;

-- Generate additional random threat events with varied labels
DO $$
DECLARE
  client_rec RECORD;
  asset_rec RECORD;
  i INTEGER;
  labels TEXT[] := ARRAY['TP', 'TN', 'FP', 'FN'];
  severities TEXT[] := ARRAY['critical', 'high', 'medium', 'low', 'info'];
  event_types TEXT[] := ARRAY['malware_detection', 'network_anomaly', 'file_modification', 'authentication_failure', 'process_injection', 'lateral_movement', 'data_exfiltration', 'privilege_escalation'];
BEGIN
  FOR client_rec IN SELECT id FROM public.clients LOOP
    FOR asset_rec IN SELECT name, ip_address FROM public.assets WHERE client_id = client_rec.id LOOP
      FOR i IN 1..15 LOOP
        INSERT INTO public.logs (
          client_id, 
          timestamp, 
          event_id, 
          event_type, 
          severity, 
          alert_name, 
          host_name, 
          host_ip, 
          label,
          status,
          comments
        ) VALUES (
          client_rec.id,
          now() - (random() * interval '30 days'),
          'TRD-' || floor(random() * 100000)::text,
          event_types[floor(random() * array_length(event_types, 1)) + 1],
          severities[floor(random() * array_length(severities, 1)) + 1],
          'Automated Threat Detection #' || i,
          asset_rec.name,
          asset_rec.ip_address,
          labels[floor(random() * array_length(labels, 1)) + 1],
          CASE 
            WHEN random() < 0.3 THEN 'active'
            WHEN random() < 0.7 THEN 'resolved'
            ELSE 'investigating'
          END,
          'Automated threat analysis result'
        )
        ON CONFLICT (event_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;