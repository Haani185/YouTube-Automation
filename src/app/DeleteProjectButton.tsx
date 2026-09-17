"use client";

import {deleteProjectAction} from "./actions";

export function DeleteProjectButton({projectId,projectTitle}:{projectId:string;projectTitle:string}){
  const action=deleteProjectAction.bind(null,projectId);
  return <form action={action} onSubmit={event=>{if(!window.confirm(`Delete “${projectTitle}” and all of its generated files? This cannot be undone.`))event.preventDefault();}}><button className="delete-project" type="submit" aria-label={`Delete ${projectTitle}`}>Delete</button></form>;
}
