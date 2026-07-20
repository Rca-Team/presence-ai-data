import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/layouts/PageLayout';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import gauravPhoto from '@/assets/gaurav-photo.png';
import { Lock, Delete, Save, Plus, Image as ImageIcon, Trophy } from 'lucide-react';

const PORTFOLIO_KEY = 'gaurav_portfolio';
const ACCESS_PIN = '2022';

type PortfolioProject = {
  title: string;
  description: string;
  stack: string;
  image: string;
  link: string;
};

type PortfolioData = {
  name: string;
  role: string;
  tagline: string;
  bio: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  profileImage: string;
  coverImage: string;
  achievements: string[];
  skills: string[];
  gallery: string[];
  projects: PortfolioProject[];
};

const DEFAULT_PORTFOLIO: PortfolioData = {
  name: 'Gaurav',
  role: 'Full Stack Developer & Team Leader',
  tagline: 'Building practical school automation systems for real-world scale.',
  bio: 'I design and ship full-stack products with a focus on reliability, realtime workflows, and meaningful user experience.',
  location: 'India',
  email: 'gaurav@example.com',
  phone: '+91 00000 00000',
  website: 'https://presences.dev',
  profileImage: gauravPhoto,
  coverImage: '',
  achievements: [
    'Led end-to-end delivery of smart attendance platform',
    'Built face-recognition gate mode with realtime alerts',
    'Shipped scalable admin workflows for school operations',
  ],
  skills: ['React', 'TypeScript', 'Supabase', 'Face Recognition', 'Realtime Systems'],
  gallery: [],
  projects: [
    {
      title: 'Presences Smart School Platform',
      description: 'Unified attendance, gate mode, analytics, and communication platform.',
      stack: 'React, TypeScript, Supabase, Face API',
      image: gauravPhoto,
      link: 'https://presences.dev',
    },
  ],
};

const Portfolio = () => {
  const { toast } = useToast();
  const [pinDigits, setPinDigits] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PortfolioData>(DEFAULT_PORTFOLIO);

  const maskedPin = useMemo(() => '●'.repeat(pinDigits.length), [pinDigits]);

  const normalizeLines = (value: string) => value.split('\n').map((v) => v.trim()).filter(Boolean);

  const loadPortfolio = async () => {
    setLoading(true);
    const { data: row, error } = await supabase
      .from('attendance_settings')
      .select('id, value')
      .eq('key', PORTFOLIO_KEY)
      .maybeSingle();

    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (!row?.value) {
      setData(DEFAULT_PORTFOLIO);
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(row.value);
      setData({
        ...DEFAULT_PORTFOLIO,
        ...parsed,
        achievements: Array.isArray(parsed?.achievements) ? parsed.achievements : DEFAULT_PORTFOLIO.achievements,
        skills: Array.isArray(parsed?.skills) ? parsed.skills : DEFAULT_PORTFOLIO.skills,
        gallery: Array.isArray(parsed?.gallery) ? parsed.gallery : DEFAULT_PORTFOLIO.gallery,
        projects: Array.isArray(parsed?.projects) ? parsed.projects : DEFAULT_PORTFOLIO.projects,
      });
    } catch {
      setData(DEFAULT_PORTFOLIO);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isUnlocked) return;
    void loadPortfolio();
  }, [isUnlocked]);

  const addPinDigit = (digit: string) => {
    if (pinDigits.length >= 4) return;
    const next = `${pinDigits}${digit}`;
    setPinDigits(next);

    if (next.length === 4) {
      if (next === ACCESS_PIN) {
        setIsUnlocked(true);
        setPinDigits('');
      } else {
        toast({ title: 'Wrong PIN', description: 'Try again', variant: 'destructive' });
        setPinDigits('');
      }
    }
  };

  const removePinDigit = () => setPinDigits((prev) => prev.slice(0, -1));

  const savePortfolio = async () => {
    setSaving(true);
    const payload = JSON.stringify(data);
    const { data: existing, error: checkError } = await supabase
      .from('attendance_settings')
      .select('id')
      .eq('key', PORTFOLIO_KEY)
      .maybeSingle();

    if (checkError) {
      setSaving(false);
      toast({ title: 'Save failed', description: checkError.message, variant: 'destructive' });
      return;
    }

    const mutation = existing?.id
      ? supabase.from('attendance_settings').update({ value: payload }).eq('id', existing.id)
      : supabase.from('attendance_settings').insert({ key: PORTFOLIO_KEY, value: payload });

    const { error } = await mutation;
    setSaving(false);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Saved', description: 'Portfolio updated successfully' });
  };

  if (!isUnlocked) {
    const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    return (
      <PageTransition>
        <PageLayout className="has-bottom-nav md:pb-0">
          <section className="mx-auto max-w-lg py-10">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Portfolio Lock</CardTitle>
                <CardDescription>Enter 4-digit PIN to access hidden portfolio editor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <p className="text-2xl tracking-[0.4em] font-semibold min-h-9">{maskedPin || '○ ○ ○ ○'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {keypad.map((key, idx) => {
                    if (!key) return <div key={`spacer-${idx}`} />;
                    if (key === 'del') {
                      return (
                        <Button key="del" variant="outline" className="h-14" onClick={removePinDigit}>
                          <Delete className="h-4 w-4" />
                        </Button>
                      );
                    }
                    return (
                      <Button key={key} variant="outline" className="h-14 text-lg" onClick={() => addPinDigit(key)}>
                        {key}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        </PageLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageLayout className="has-bottom-nav md:pb-0">
        <section className="space-y-6 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Gaurav Portfolio Studio</h1>
              <p className="text-sm text-muted-foreground">Fully customizable profile, achievements, projects, and gallery.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Hidden Page</Badge>
              <Button variant="outline" onClick={() => setIsUnlocked(false)}>Lock</Button>
              <Button onClick={savePortfolio} disabled={saving || loading}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Basic details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={data.name} onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={data.role} onChange={(e) => setData((prev) => ({ ...prev, role: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Tagline</Label>
                <Input value={data.tagline} onChange={(e) => setData((prev) => ({ ...prev, tagline: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Bio</Label>
                <Textarea value={data.bio} onChange={(e) => setData((prev) => ({ ...prev, bio: e.target.value }))} rows={4} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={data.location} onChange={(e) => setData((prev) => ({ ...prev, location: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={data.email} onChange={(e) => setData((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={data.phone} onChange={(e) => setData((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={data.website} onChange={(e) => setData((prev) => ({ ...prev, website: e.target.value }))} />
              </div>
              <div>
                <Label>Profile image URL</Label>
                <Input value={data.profileImage} onChange={(e) => setData((prev) => ({ ...prev, profileImage: e.target.value }))} />
              </div>
              <div>
                <Label>Cover image URL</Label>
                <Input value={data.coverImage} onChange={(e) => setData((prev) => ({ ...prev, coverImage: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Achievements</CardTitle>
                <CardDescription>One line per achievement</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  value={data.achievements.join('\n')}
                  onChange={(e) => setData((prev) => ({ ...prev, achievements: normalizeLines(e.target.value) }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>One line per skill</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  value={data.skills.join('\n')}
                  onChange={(e) => setData((prev) => ({ ...prev, skills: normalizeLines(e.target.value) }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Gallery</CardTitle>
              <CardDescription>One image URL per line</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={6}
                value={data.gallery.join('\n')}
                onChange={(e) => setData((prev) => ({ ...prev, gallery: normalizeLines(e.target.value) }))}
              />
              {data.gallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.gallery.slice(0, 8).map((url) => (
                    <img key={url} src={url} alt="Portfolio gallery" className="h-24 w-full rounded-md border object-cover" loading="lazy" />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Add, edit, or remove portfolio projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.projects.map((project, index) => (
                <div key={`${project.title}-${index}`} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Project {index + 1}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setData((prev) => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }))}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={project.title}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p, i) => (i === index ? { ...p, title: e.target.value } : p)),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Tech stack</Label>
                      <Input
                        value={project.stack}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p, i) => (i === index ? { ...p, stack: e.target.value } : p)),
                          }))
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        rows={3}
                        value={project.description}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p, i) => (i === index ? { ...p, description: e.target.value } : p)),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Image URL</Label>
                      <Input
                        value={project.image}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p, i) => (i === index ? { ...p, image: e.target.value } : p)),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Project link</Label>
                      <Input
                        value={project.link}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            projects: prev.projects.map((p, i) => (i === index ? { ...p, link: e.target.value } : p)),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() =>
                  setData((prev) => ({
                    ...prev,
                    projects: [...prev.projects, { title: '', description: '', stack: '', image: '', link: '' }],
                  }))
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add project
              </Button>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>This preview uses your current editor data before save.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.coverImage ? (
                <img src={data.coverImage} alt="Portfolio cover" className="h-44 w-full rounded-lg border object-cover" loading="lazy" />
              ) : null}
              <div className="flex items-start gap-4">
                <img src={data.profileImage || gauravPhoto} alt={data.name} className="h-20 w-20 rounded-lg border object-cover" loading="lazy" />
                <div>
                  <h2 className="text-xl font-bold">{data.name}</h2>
                  <p className="text-sm text-muted-foreground">{data.role}</p>
                  <p className="mt-1 text-sm">{data.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{data.bio}</p>
            </CardContent>
          </Card>
        </section>
      </PageLayout>
    </PageTransition>
  );
};

export default Portfolio;