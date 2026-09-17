"use client";

import { useState } from "react";

type FormAction=(formData:FormData)=>void|Promise<void>;
type SourceOption={id:string;title:string};

export function SourceForm({projectId,action}:{projectId:string;action:FormAction}){
  const [draft,setDraft]=useState({title:"",publisher:"",trustLevel:"PRIMARY",url:"",publishedAt:"",notes:""});
  const [status,setStatus]=useState("");
  const [isSubmitting,setIsSubmitting]=useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setStatus("");
    try {
      await action(formData);
      setDraft({title:"",publisher:"",trustLevel:"PRIMARY",url:"",publishedAt:"",notes:""});
      setStatus("Source saved successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to add source");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function generate(){
    setStatus("Searching for a relevant source…");
    try{
      const response=await fetch(`/api/projects/${projectId}/research/source-draft`,{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Source generation failed");
      setDraft({...body,publishedAt:body.publishedAt??""});
      setStatus("Draft ready—review every field, then click Add source.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Source generation failed");
    }
  }

  return (
    <form className="form compact-form" action={handleSubmit}>
      <input
        name="title"
        placeholder="Source title"
        required
        maxLength={300}
        value={draft.title}
        onChange={event=>setDraft({...draft,title:event.target.value})}
      />
      <div className="form-row">
        <input
          name="publisher"
          placeholder="Publisher"
          required
          maxLength={200}
          value={draft.publisher}
          onChange={event=>setDraft({...draft,publisher:event.target.value})}
        />
        <select
          name="trustLevel"
          value={draft.trustLevel}
          onChange={event=>setDraft({...draft,trustLevel:event.target.value})}
        >
          <option>PRIMARY</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
      </div>
      <input
        name="url"
        type="url"
        placeholder="https://..."
        required
        value={draft.url}
        onChange={event=>setDraft({...draft,url:event.target.value})}
      />
      <input
        name="publishedAt"
        type="date"
        value={draft.publishedAt}
        onChange={event=>setDraft({...draft,publishedAt:event.target.value})}
      />
      <textarea
        name="notes"
        placeholder="What this source establishes"
        required
        maxLength={10000}
        value={draft.notes}
        onChange={event=>setDraft({...draft,notes:event.target.value})}
      />
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add source"}</button>
      <div className="ai-assist">
        <p><strong>Fill this form with AI</strong><span>Find topic-relevant source details, then review before saving.</span></p>
        <button type="button" onClick={generate}>✦ AI fill source fields</button>
      </div>
      {status&&<p className="assist-status" role="status">{status}</p>}
    </form>
  );
}

export function ClaimForm({projectId,action,sources}:{projectId:string;action:FormAction;sources:SourceOption[]}){
  const [draft,setDraft]=useState({claimText:"",sourceId:sources[0]?.id??"",supportStatus:"SUPPORTED",riskLevel:"LOW",evidence:"",asOfDate:""});
  const [status,setStatus]=useState("");
  const [isSubmitting,setIsSubmitting]=useState(false);
  const selectedSourceId=draft.sourceId||sources[0]?.id||"";

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setStatus("");
    try {
      await action(formData);
      setDraft({claimText:"",sourceId:sources[0]?.id??"",supportStatus:"SUPPORTED",riskLevel:"LOW",evidence:"",asOfDate:""});
      setStatus("Claim saved successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to add claim");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function generate(){
    if(!selectedSourceId){setStatus("Add and save a source first.");return}
    setStatus("Creating a claim from the selected source…");
    try{
      const response=await fetch(`/api/projects/${projectId}/research/claim-draft?sourceId=${encodeURIComponent(selectedSourceId)}`,{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Claim generation failed");
      setDraft({...body,sourceId:body.sourceId??selectedSourceId,asOfDate:body.asOfDate??""});
      setStatus("Draft ready—review every field, then click Add claim.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"Claim generation failed");
    }
  }

  return (
    <form className="form compact-form" action={handleSubmit}>
      <textarea
        name="claimText"
        placeholder="Exact factual claim"
        required
        maxLength={2000}
        value={draft.claimText}
        onChange={event=>setDraft({...draft,claimText:event.target.value})}
      />
      <select
        name="sourceId"
        value={selectedSourceId}
        onChange={event=>setDraft({...draft,sourceId:event.target.value})}
      >
        <option value="">No source</option>
        {sources.map(source=><option key={source.id} value={source.id}>{source.title}</option>)}
      </select>
      <div className="form-row">
        <select
          name="supportStatus"
          value={draft.supportStatus}
          onChange={event=>setDraft({...draft,supportStatus:event.target.value})}
        >
          <option>SUPPORTED</option>
          <option>PARTIAL</option>
          <option>UNSUPPORTED</option>
          <option>STALE</option>
        </select>
        <select
          name="riskLevel"
          value={draft.riskLevel}
          onChange={event=>setDraft({...draft,riskLevel:event.target.value})}
        >
          <option>LOW</option>
          <option>MEDIUM</option>
          <option>HIGH</option>
        </select>
      </div>
      <textarea
        name="evidence"
        placeholder="Evidence or exact supporting explanation"
        required
        maxLength={5000}
        value={draft.evidence}
        onChange={event=>setDraft({...draft,evidence:event.target.value})}
      />
      <input
        name="asOfDate"
        type="date"
        value={draft.asOfDate}
        onChange={event=>setDraft({...draft,asOfDate:event.target.value})}
      />
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add claim"}</button>
      <div className="ai-assist">
        <p><strong>Fill this form with AI</strong><span>{sources.length?"Build a claim and evidence from the selected source.":"Save a source first to enable claim generation."}</span></p>
        <button type="button" disabled={sources.length===0} onClick={generate}>✦ AI fill claim fields</button>
      </div>
      {status&&<p className="assist-status" role="status">{status}</p>}
    </form>
  );
}
