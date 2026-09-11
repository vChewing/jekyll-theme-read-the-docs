/* global $, DOMPurify, ui */

function search(data) {
  let text = new URL(location.href).searchParams.get("q");
  // eslint-disable-next-line no-unused-vars
  let lang = new URL(location.href).searchParams.get("lang") || ui.lang;

  $("input[name='q']").val(text);

  let results = [];
  let regexp = new RegExp();
  try {
    regexp = new RegExp(text, "im");
  } catch (e) {
    $(".search-results .content").empty();
    $(".search-results .summary").html(ui.i18n.search_results_not_found);
    $(".search-results h2").html(ui.i18n.search_results);
    return debug(e.message);
  }

  function slice(content, min, max) {
    return content
      .slice(min, max)
      .replace(regexp, (match) => `<span class="bg-yellow">${match}</span>`);
  }

  for (const page of data) {
    let [title, content] = [null, null];
    try {
      if (page.title) {
        title = page.title.match(regexp);
      } else {
        if (page.url == "/") {
          page.title = ui.title;
        } else {
          page.title = page.url;
        }
      }
    } catch (e) {
      debug(e.message);
    }
    try {
      if (page.content) {
        const _sanitizeContent = DOMPurify.sanitize(page.content);
        page.content = $("<div/>").html(_sanitizeContent).text();
        content = page.content.match(regexp);
      }
    } catch (e) {
      debug(e.message);
    }
    if (title || content) {
      let result = [
        `<a href="${ui.baseurl}${page.url}?highlight=${text}">${page.title}</a>`,
      ];
      if (content) {
        let [min, max] = [content.index - 100, content.index + 100];
        let [prefix, suffix] = ["...", "..."];

        if (min < 0) {
          prefix = "";
          min = 0;
        }
        if (max > page.content.length) {
          suffix = "";
          max = page.content.length;
        }
        result.push(
          `<p class="text-gray">${prefix}${slice(
            page.content,
            min,
            max,
          )}${suffix}</p>`,
        );
      }
      results.push(`<li class="border-top py-4">${result.join("")}</li>`);
    }
  }
  if (results.length > 0 && text.length > 0) {
    const _sanitizeResults = DOMPurify.sanitize(results.join(""));
    $(".search-results .content").html(_sanitizeResults);
    $(".search-results .summary").html(
      ui.i18n.search_results_found.replace("#", results.length),
    );
  } else {
    $(".search-results .content").empty();
    $(".search-results .summary").html(ui.i18n.search_results_not_found);
  }
  $(".search-results h2").html(ui.i18n.search_results);
}

function initialize(name) {
  let link = $(".toctree").find(`[href="${decodeURI(name)}"]`);

  if (link.length > 0) {
    $(".toctree .current").removeClass("current");
    link.addClass("current");
    link.closest(".level-1").parent().addClass("current");
    for (let i = 1; i <= 11; i++) {
      link.closest(`.level-${i}`).addClass("current");
    }
  }
}

function toggleCurrent(link) {
  let closest = link.closest("li");
  closest.siblings("li.current").removeClass("current");
  closest.siblings().find("li.current").removeClass("current");
  closest.find("> ul li.current").removeClass("current");
  closest.toggleClass("current");
}

function toc() {
  // 頁面可用 front matter 的 autohide_article_chapter_index 關掉側欄裡的篇章結構
  if (document.body.classList.contains("autohide-chapter-index")) return;

  // 側邊欄的當前條目（一般內頁）
  const $currentLi = $(".toctree li.current");
  let $list = null;
  let level = 1;

  if ($currentLi.length) {
    $currentLi.append('<ul class="content-toc"></ul>');
    $list = $currentLi.find(".content-toc").first();
    level = parseInt($currentLi.get(0).dataset.level, 10) || 1;
  } else {
    // 分類首頁（例：/manual/）：側邊欄沒有該頁自身的條目（它的條目是 caption），
    // 此時把本章節樹掛到該分類標題之下，否則整段章節結構會消失。
    const $dir = $(".toctree details.toc-dir.current-section");
    if (!$dir.length) return;

    $list = $('<ul class="content-toc"></ul>').insertAfter($dir.children("summary"));
    level = 2;
  }

  let temp = 0;
  let stack = [$list];

  $(".markdown-body")
    .find("h2,h3,h4,h5,h6")
    .each(function () {
      let anchor = $("<a/>")
        .addClass("d-flex flex-items-baseline")
        .text($(this).text())
        .attr("href", `#${this.id}`);
      let tagLevel = parseInt(this.tagName.slice(1)) - 1;

      if (tagLevel > temp) {
        let parent = stack[0].children("li:last")[0];
        if (parent) {
          stack.unshift($("<ul/>").appendTo(parent));
        }
      } else {
        stack.splice(
          0,
          Math.min(temp - tagLevel, Math.max(stack.length - 1, 0)),
        );
      }
      temp = tagLevel;

      $("<li/>")
        .addClass(`toc level-${level + tagLevel}`)
        .append(anchor)
        .appendTo(stack[0]);
    });

  if (!$list.children().length) {
    $list.remove();
  }
}

function set(name, value) {
  return localStorage.setItem(name, value);
}

function get(name) {
  return localStorage.getItem(name) || false;
}

function debug() {
  console.debug.apply(console, arguments);
}

function restore() {
  let scroll = get("scroll");
  let scrollTime = get("scrollTime");
  let scrollHost = get("scrollHost");

  if (scroll && scrollTime && scrollHost) {
    if (scrollHost == location.host && Date.now() - scrollTime < 6e5) {
      $(".sidebar").scrollTop(scroll);
    }
  }
  $(".sidebar").on("scroll", function () {
    set("scroll", this.scrollTop);
    set("scrollTime", Date.now());
    set("scrollHost", location.host);
  });
}

function theme() {
  const modes = ["auto", "light", "dark"];
  const icons = {
    auto: "fa-adjust",
    light: "fa-sun-o",
    dark: "fa-moon-o",
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function saved() {
    // localStorage wins; otherwise an author-provided data-theme attribute
    // (e.g. a hard-coded default in a custom layout); otherwise auto.
    const mode =
      get("theme") || document.documentElement.getAttribute("data-theme");
    return !mode || modes.indexOf(mode) === -1 ? "auto" : mode;
  }

  function system() {
    return media.matches ? "dark" : "light";
  }

  function paint() {
    const mode = saved();
    const root = document.documentElement;

    if (mode === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }

    const scheme = mode === "auto" ? system() : mode;
    if (window.ui && ui.theme) {
      $('meta[name="theme-color"]').attr(
        "content",
        scheme === "dark" ? ui.theme.dark : ui.theme.light,
      );
    }

    const label = (window.ui && ui.i18n && ui.i18n[`theme_${mode}`]) || mode;
    $(".theme-toggle")
      .attr("title", label)
      .attr("aria-label", label)
      .find("i")
      .attr("class", `fa ${icons[mode]}`);
  }

  $(".theme-toggle").on("click", function () {
    // auto -> the opposite of the system scheme -> the system scheme -> auto
    const order = ["auto", system() === "dark" ? "light" : "dark", system()];
    const index = order.indexOf(saved());
    set("theme", order[(index + 1) % order.length]);
    paint();
  });

  if (media.addEventListener) {
    media.addEventListener("change", paint);
  } else if (media.addListener) {
    media.addListener(paint);
  }

  paint();
}

function carousel() {
  $("carousel").each(function () {
    var $c = $(this);
    var interval = (parseFloat($c.attr("timesec")) || 9) * 1000;

    // 收集圖片：優先取 <img>；都沒有的話代為解析 markdown 圖片語法
    //（kramdown 不會解析自訂標籤內的 markdown，所以由前端補上）
    var items = [];
    $c.find("img").each(function () {
      items.push({
        src: this.getAttribute("src"),
        alt: this.getAttribute("alt") || "",
        title: this.getAttribute("title") || "",
      });
    });
    if (!items.length) {
      var re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
      var m;
      while ((m = re.exec($c.text())) !== null) {
        items.push({ src: m[2], alt: m[1], title: m[3] || "" });
      }
    }
    if (!items.length) return;

    // 重建內容：標題、副標、視窗、箭頭、圓點
    var $title = $c.find("carousel_title").first();
    var $subtitle = $c.find("carousel_subtitle").first();
    $c.empty();
    if ($title.length) $c.append($title.addClass("carousel_title"));
    if ($subtitle.length) $c.append($subtitle.addClass("carousel_subtitle"));

    var $viewport = $('<div class="carousel_viewport"></div>').appendTo($c);
    var $dots = $('<div class="carousel_dots"></div>').appendTo($c);
    var slides = [];

    items.forEach(function (it, i) {
      var $slide = $('<div class="carousel_slide"></div>').appendTo($viewport);
      $("<img/>")
        .attr({ src: it.src, alt: it.alt, title: it.title, loading: i ? "lazy" : "eager" })
        .appendTo($slide);
      slides.push($slide);
      $('<button class="carousel_dot" type="button"></button>')
        .attr("aria-label", it.alt || "slide " + (i + 1))
        .on("click", function () {
          show(i, true);
        })
        .appendTo($dots);
    });

    var index = 0;
    var timer = null;
    function show(i, manual) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function ($s, k) {
        $s.toggleClass("is-active", k === index);
      });
      $dots.children().each(function (k) {
        $(this).toggleClass("is-active", k === index);
      });
      if (manual) restart();
    }
    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        show(index + 1);
      }, interval);
    }

    if (slides.length > 1) {
      $('<button class="carousel_arrow carousel_arrow--prev" type="button" aria-label="Previous">\u2039</button>')
        .on("click", function () {
          show(index - 1, true);
        })
        .appendTo($c);
      $('<button class="carousel_arrow carousel_arrow--next" type="button" aria-label="Next">\u203a</button>')
        .on("click", function () {
          show(index + 1, true);
        })
        .appendTo($c);
      restart();
      $c.on("mouseenter focusin", function () {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
      $c.on("mouseleave focusout", function () {
        if (!timer) restart();
      });
    }

    $c.addClass("carousel-ready");
    show(0);
  });
}

function tocDirs() {
  const KEY = "toc-open-dirs";
  let saved = {};
  try {
    saved = JSON.parse(get(KEY) || "{}") || {};
  } catch (e) {
    saved = {};
  }

  $(".toctree details.toc-dir").each(function () {
    const $dir = $(this);
    const key = $dir.attr("data-dir") || "";

    // 當前頁面所屬的大分類一律保持展開，其餘預設收合。
    if ($dir.is("[data-current]")) {
      this.open = true;
      return;
    }

    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      this.open = !!saved[key];
    }

    $dir.on("toggle", function () {
      saved[key] = this.open;
      try {
        set(KEY, JSON.stringify(saved));
      } catch (e) {
        debug(e.message);
      }
    });
  });
}

function highlight() {
  const _sanitizeUrl = DOMPurify.sanitize(location.href);
  let text = new URL(_sanitizeUrl).searchParams.get("highlight");

  if (text) {
    $(".markdown-body")
      .find("*")
      .each(function () {
        try {
          if (this.outerHTML.match(new RegExp(text, "im"))) {
            $(this).addClass("search-result");
            $(this).parentsUntil(".markdown-body").removeClass("search-result");
          }
        } catch (e) {
          debug(e.message);
        }
      });
    // last node
    $(".search-result").each(function () {
      $(this).html(function (i, html) {
        return html.replace(text, `<span class="bg-yellow">${text}</span>`);
      });
    });
    $(".search input").val(text);
  }
}

$(window).on("hashchange", () =>
  initialize(location.hash || location.pathname),
);

$(document).on("scroll", function () {
  let start = $(this).scrollTop() + 5;
  let items = [];

  $(".markdown-body")
    .find("h1,h2,h3,h4,h5,h6")
    .each(function () {
      items.push({
        offset: $(this).offset().top,
        id: this.id,
        level: parseInt(this.tagName.slice(1)),
      });
    });
  for (let i = 0; i < items.length; i++) {
    if (start > items[i].offset) {
      if (i < items.length - 1) {
        if (start < items[i + 1].offset) {
          if (items[i].level == 1) {
            initialize(location.pathname);
          } else {
            initialize("#" + items[i].id);
          }
        }
      } else {
        initialize("#" + items[i].id);
      }
    }
  }
});

$("#toggle").on("click", function () {
  $(".sidebar-wrap,.content-wrap").toggleClass("shift");
});

if (location.pathname == `${ui.baseurl}/search.html`) {
  $.ajax(`${ui.baseurl}/data.json`)
    .done(search)
    .fail((xhr, message) => debug(message));
}

toc();
initialize(location.pathname);
initialize(location.hash);
restore();
highlight();
theme();
tocDirs();
carousel();

/* nested ul */
$(".toc ul")
  .siblings("a")
  .each(function () {
    let link = $(this);
    let expand = $('<i class="fa fa-plus-square-o"></i>');

    expand.on("click", function (e) {
      e.stopPropagation();
      toggleCurrent(link);
      return false;
    });
    link.prepend(expand);
  });

$(".markdown-body :header").append(function () {
  return `<a href="#${this.id}" class="anchor"><i class="octicon-link fa fa-link text-blue"></i></a>`;
});

$("div.highlighter-rouge").each(function () {
  const match = $(this)
    .attr("class")
    .match(/language-(\w+)/);
  if (match) {
    $(this).attr("data-lang", match[1]);
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${ui.baseurl}/sw.caches.js`);
} else {
  debug("Service Worker not supported!");
}

$(function () {
  /**
   * Add target="'_blank" to all external links
   */
  $("a[href^='http']").each(function () {
    /* console.debug("link", this.href); */
    let rel = $(this).attr("rel");
    rel =
      "noopener noreferrer" +
      (rel && !rel.match("noopener noreferrer") ? " " + rel : "");
    /* console.debug("rel", rel); */
    $(this).attr({ target: "_blank", rel: rel });
  });

  /**
   * For single README.md in docs/
   *
   * Test by boolean
   * const _sidebar = $("div.sidebar > div.toctree > ul").children().length > 0 || false
   * console.debug("Sidebar", _sidebar)
   * if (_sidebar) return
   */

  const _sidebar = $("div.sidebar > div.toctree > ul").children().length || 0;
  console.debug("_sidebar", _sidebar);
  if (_sidebar) return;

  $(".markdown-body h2, .markdown-body h3").each(function (index) {
    let level_ = (parseInt(this.nodeName.slice(-1)) - 1).toString();
    const _sanitizeText = DOMPurify.sanitize($(this).text());
    $(".toctree ul").append(
      `<li class='toc level-${level_} tag-${this.nodeName.toLowerCase()}' data-sort='${(
        index + 1
      ).toString()}' data-level='${level_}'><a class='d-flex flex-items-baseline' href='#${$(
        this,
      )
        .text()
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "")}'>${_sanitizeText}</a></li>`,
    );
    $(this).attr(
      "id",
      $(this)
        .text()
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, ""),
    );
    $(".toctree ul li:first-child a").parent().addClass("current");
  });

  $("toctree ul li").on("click", "a", function (event) {
    var position = $($(this).attr("href")).offset().top - 190;
    $("html, body").animate({ scrollTop: position }, 400);
    $("toctree ul li a").parent().removeClass("current");
    $(this).parent().addClass("current");
    event.preventDefault();
  });
});
