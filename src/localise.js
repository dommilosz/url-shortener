let config = "%key=%${config}%";

document.querySelectorAll(".loc").forEach(el=>{
    let injectMethod = "innerHTML";
    el.className.split(" ").forEach(c=>{
        //loc-inj-placeholder
        if(c.startsWith("loc-inj-")){
            injectMethod = c.split('loc-inj-')[1];
        }
    })
    let locID = '';
    el.id.split(" ").forEach(id=>{
        if(id.startsWith("loc-")){
            locID = id;
        }
    })

    el[injectMethod] = config[locID];
})